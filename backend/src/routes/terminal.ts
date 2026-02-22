/**
 * Agent Lee — Host Terminal Route (Layer 30: VSCodeBridge)
 * LEEWAY-CORE-2026
 *
 * REST:
 *   POST /api/terminal/session       → { sessionId }
 *   POST /api/terminal/kill          → { ok }
 *   GET  /api/terminal/audit         → audit events for session
 *   GET  /api/terminal/snapshot      → last N lines + hashes
 *   GET  /api/terminal/sessions      → list active sessions
 *
 * WebSocket (handled in index.ts upgrade):
 *   WS /api/terminal/ws?sessionId=   → interactive PTY stream
 */

import { Router, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import crypto from 'crypto';
import os from 'os';
import { evaluateCommand, type PolicyMode } from '../services/terminal-policy.js';
import { auditLog, getAuditBySession, getAuditSnapshot } from '../services/terminal-audit.js';

const HANDSHAKE = process.env.NEURAL_HANDSHAKE || 'AGENT_LEE_SOVEREIGN_V1';
const MAX_SESSIONS = Number(process.env.TERMINAL_MAX_SESSIONS || 10);
const DEFAULT_SHELL = process.env.TERMINAL_SHELL ||
  (os.platform() === 'win32' ? 'pwsh' : 'bash');

// ── Session Registry ───────────────────────────────────────────────────────
interface TerminalSession {
  id:       string;
  pty:      pty.IPty;
  mode:     PolicyMode;
  ws?:      WebSocket;
  cwd:      string;
  created:  string;
  alive:    boolean;
  outputBuf: string;
}

const sessions = new Map<string, TerminalSession>();

// ── Router ────────────────────────────────────────────────────────────────
export const terminalRouter = Router();

/** Handshake guard for REST */
function guardREST(req: Request, res: Response): boolean {
  const h = req.headers['x-neural-handshake'] || req.headers['authorization'];
  if (h !== HANDSHAKE && h !== `Bearer ${HANDSHAKE}`) {
    res.status(401).json({ error: 'INVALID_HANDSHAKE' });
    return false;
  }
  return true;
}

// POST /api/terminal/session
terminalRouter.post('/session', (req, res) => {
  if (!guardREST(req, res)) return;
  if (sessions.size >= MAX_SESSIONS) {
    res.status(429).json({ error: 'MAX_SESSIONS_REACHED', limit: MAX_SESSIONS });
    return;
  }
  const sessionId = crypto.randomUUID();
  const mode: PolicyMode = (req.body?.mode as PolicyMode) || 'safe';
  const cwd = req.body?.cwd || process.cwd();

  const ptyProc = pty.spawn(DEFAULT_SHELL, [], {
    name: 'xterm-256color',
    cols: req.body?.cols || 120,
    rows: req.body?.rows || 30,
    cwd,
    env: { ...process.env } as Record<string, string>,
  });

  const session: TerminalSession = {
    id: sessionId, pty: ptyProc, mode, cwd, ws: undefined,
    created: new Date().toISOString(), alive: true, outputBuf: '',
  };
  sessions.set(sessionId, session);

  // Kill session when PTY exits
  ptyProc.onExit(() => {
    session.alive = false;
    session.ws?.close();
    sessions.delete(sessionId);
    console.log(`[terminal] Session ${sessionId} exited`);
  });

  console.log(`[terminal] Session ${sessionId} created — shell: ${DEFAULT_SHELL}, mode: ${mode}`);
  res.json({ sessionId, mode, shell: DEFAULT_SHELL, cwd });
});

// POST /api/terminal/kill
terminalRouter.post('/kill', (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) { res.status(404).json({ error: 'SESSION_NOT_FOUND' }); return; }
  session.pty.kill();
  sessions.delete(sessionId);
  res.json({ ok: true, sessionId });
});

// GET /api/terminal/audit
terminalRouter.get('/audit', (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId } = req.query as { sessionId?: string };
  if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
  res.json({ events: getAuditBySession(sessionId) });
});

// GET /api/terminal/snapshot
terminalRouter.get('/snapshot', (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId, n } = req.query as { sessionId?: string; n?: string };
  if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
  res.json(getAuditSnapshot(sessionId, Number(n || 50)));
});

// GET /api/terminal/sessions
terminalRouter.get('/sessions', (req, res) => {
  if (!guardREST(req, res)) return;
  const list = [...sessions.entries()].map(([id, s]) => ({
    id, mode: s.mode, cwd: s.cwd, created: s.created, alive: s.alive,
    connected: !!s.ws,
  }));
  res.json({ sessions: list, count: list.length });
});

// ── WebSocket PTY Server (noServer — wired in index.ts) ───────────────────
export const terminalWss = new WebSocketServer({ noServer: true });

terminalWss.on('connection', (ws: WebSocket, req: Request) => {
  const url    = new URL(req.url!, `http://localhost`);
  const sessId = url.searchParams.get('sessionId') || '';
  const session = sessions.get(sessId);

  if (!session) {
    ws.send(JSON.stringify({ type: 'error', msg: 'SESSION_NOT_FOUND' }));
    ws.close();
    return;
  }

  if (session.ws) {
    session.ws.close();   // evict old connection
  }
  session.ws = ws;

  console.log(`[terminal] WS attached to session ${sessId}`);

  // PTY → WS
  session.pty.onData((data: string) => {
    session.outputBuf += data;
    // Keep last 10 KB in buffer
    if (session.outputBuf.length > 10_240) {
      session.outputBuf = session.outputBuf.slice(-10_240);
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  // WS → PTY (with policy gate)
  ws.on('message', async (raw: Buffer | string) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'input') {
      // Only evaluate complete commands (newline-terminated)
      if (msg.data?.includes('\n') || msg.data?.includes('\r')) {
        const cmd = msg.data.trim();
        if (cmd) {
          const verdict = evaluateCommand(cmd, session.mode);
          await auditLog({
            sessionId: sessId,
            target:    'host',
            command:   cmd,
            cwd:       session.cwd,
            allowed:   verdict.allowed,
            risk:      verdict.risk,
            user:      'agentlee',
            outputSnippet: '',
          });

          if (!verdict.allowed) {
            ws.send(JSON.stringify({
              type: 'policy_block',
              reason: verdict.reason,
              command: cmd,
              mode: session.mode,
            }));
            // Show denial in terminal
            session.pty.write(`\r\n[POLICY BLOCK] ${verdict.reason}\r\n`);
            return;
          }
        }
      }
      session.pty.write(msg.data);
    } else if (msg.type === 'resize') {
      session.pty.resize(msg.cols || 120, msg.rows || 30);
    } else if (msg.type === 'set_mode') {
      const newMode = msg.mode as PolicyMode;
      if (['safe', 'build', 'admin'].includes(newMode)) {
        session.mode = newMode;
        ws.send(JSON.stringify({ type: 'mode_changed', mode: newMode }));
      }
    }
  });

  ws.on('close', () => {
    console.log(`[terminal] WS disconnected from session ${sessId}`);
    if (session.ws === ws) session.ws = undefined;
  });

  ws.on('error', (e) => {
    console.error('[terminal] WS error:', e.message);
  });
});
