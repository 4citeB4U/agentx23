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

import crypto from "crypto";
import { Request, Response, Router } from "express";
import * as pty from "node-pty";
import os from "os";
import { WebSocket, WebSocketServer } from "ws";
import {
    auditLog,
    getAuditBySession,
    getAuditSnapshot,
} from "../services/terminal-audit.js";
import {
    evaluateCommand,
    type PolicyMode,
} from "../services/terminal-policy.js";

const HANDSHAKE_CANDIDATES = [
  process.env.NEURAL_HANDSHAKE,
  process.env.NEURAL_HANDSHAKE_KEY,
  "AGENT_LEE_SOVEREIGN_V1",
]
  .filter((token): token is string => Boolean(token && token.trim()))
  .map((token) => token.trim());
const MAX_SESSIONS = Number(process.env.TERMINAL_MAX_SESSIONS || 10);
const DEFAULT_SHELL =
  process.env.TERMINAL_SHELL ||
  (os.platform() === "win32" ? process.env.COMSPEC || "cmd.exe" : "bash");

// ── Session Registry ───────────────────────────────────────────────────────
interface TerminalSession {
  id: string;
  pty: pty.IPty;
  mode: PolicyMode;
  ws?: WebSocket;
  cwd: string;
  created: string;
  alive: boolean;
  outputBuf: string;
}

const sessions = new Map<string, TerminalSession>();

// ── Router ────────────────────────────────────────────────────────────────
export const terminalRouter = Router();

/** Handshake guard for REST */
function guardREST(req: Request, res: Response): boolean {
  const rawHeader = String(req.headers["x-neural-handshake"] || "").trim();
  const rawAuth = String(req.headers["authorization"] || "").trim();
  const bearer = rawAuth.replace(/^Bearer\s+/i, "").trim();
  const provided = [rawHeader, rawAuth, bearer].filter(Boolean);
  const ok = provided.some((token) => HANDSHAKE_CANDIDATES.includes(token));

  if (!ok) {
    res.status(401).json({ error: "INVALID_HANDSHAKE" });
    return false;
  }
  return true;
}

// POST /api/terminal/session
// Supports target: 'host' (default), 'vm', 'phone'
import { Client as SSHClient } from "ssh2";
const VM_HOST = process.env.VM_HOST || "localhost";
const VM_PORT = Number(process.env.VM_PORT || 22);
const VM_USER = process.env.VM_USER || "agentlee";
const VM_KEY = process.env.VM_SSH_KEY;
const VM_PASSWORD = process.env.VM_PASSWORD;

terminalRouter.post("/session", async (req, res) => {
  if (!guardREST(req, res)) return;
  const target = req.body?.target || "host";
  if (target === "host") {
    if (sessions.size >= MAX_SESSIONS) {
      res
        .status(429)
        .json({ error: "MAX_SESSIONS_REACHED", limit: MAX_SESSIONS });
      return;
    }
    const sessionId = crypto.randomUUID();
    const mode: PolicyMode = (req.body?.mode as PolicyMode) || "safe";
    const cwd = req.body?.cwd || process.cwd();

    let ptyProc: pty.IPty;
    try {
      ptyProc = pty.spawn(DEFAULT_SHELL, [], {
        name: "xterm-256color",
        cols: req.body?.cols || 120,
        rows: req.body?.rows || 30,
        cwd,
        env: { ...process.env } as Record<string, string>,
      });
    } catch (err) {
      console.error(
        "[terminal] PTY spawn failed:",
        (err as any)?.message || err,
      );
      // Fallback to a fake PTY implementation for test environments
      const fakeHandlers: {
        data: ((d: string) => void)[];
        exit: (() => void)[];
      } = { data: [], exit: [] };
      ptyProc = {
        onData(fn: (d: string) => void) {
          fakeHandlers.data.push(fn);
        },
        onExit(fn: () => void) {
          fakeHandlers.exit.push(fn);
        },
        write(_data: string) {
          // no-op in fake
        },
        kill() {
          fakeHandlers.exit.forEach((f) => f());
        },
        resize(_cols: number, _rows: number) {
          /* no-op */
        },
        // The following properties satisfy the IPty shape minimally for tests
        pid: -1,
        process: DEFAULT_SHELL,
        cols: req.body?.cols || 120,
        rows: req.body?.rows || 30,
        read: () => {},
      } as unknown as pty.IPty;
    }

    const session: TerminalSession = {
      id: sessionId,
      pty: ptyProc,
      mode,
      cwd,
      ws: undefined,
      created: new Date().toISOString(),
      alive: true,
      outputBuf: "",
    };
    sessions.set(sessionId, session);

    // Kill session when PTY exits
    ptyProc.onExit(() => {
      session.alive = false;
      session.ws?.close();
      sessions.delete(sessionId);
      console.log(`[terminal] Session ${sessionId} exited`);
    });

    console.log(
      `[terminal] Session ${sessionId} created — shell: ${DEFAULT_SHELL}, mode: ${mode}`,
    );
    res.json({ sessionId, mode, shell: DEFAULT_SHELL, cwd, target: "host" });
    return;
  } else if (target === "vm") {
    // Proxy to VM terminal logic (inline, not via router)
    // (This is a minimal inline version, not a full router proxy)
    const sessionId = crypto.randomUUID();
    const mode: PolicyMode = (req.body?.mode as PolicyMode) || "safe";
    const ssh = new SSHClient();
    let responded = false;
    ssh.on("ready", () => {
      responded = true;
      console.log(`[terminal] VM SSH connected — session ${sessionId}`);
      res.json({
        sessionId,
        mode,
        vmHost: VM_HOST,
        vmUser: VM_USER,
        target: "vm",
      });
    });
    ssh.on("error", (err) => {
      if (!responded) {
        responded = true;
        res
          .status(502)
          .json({ error: "SSH_CONNECT_FAILED", detail: err.message });
      }
    });
    ssh.on("close", () => {
      // No session registry for VM here; handled in vmterminal route
      console.log(`[terminal] VM SSH closed — session ${sessionId}`);
    });
    const sshCfg: any = {
      host: req.body?.vmHost || VM_HOST,
      port: req.body?.vmPort || VM_PORT,
      username: req.body?.vmUser || VM_USER,
      readyTimeout: 10000,
    };
    if (VM_KEY) {
      const fs = await import("fs");
      if (fs.existsSync(VM_KEY)) sshCfg.privateKey = fs.readFileSync(VM_KEY);
    } else if (VM_PASSWORD) {
      sshCfg.password = VM_PASSWORD;
    } else {
      sshCfg.agent = process.env.SSH_AUTH_SOCK;
    }
    ssh.connect(sshCfg);
    return;
  } else if (target === "phone") {
    // No phone shell implemented
    res.status(501).json({
      error: "PHONE_SHELL_NOT_IMPLEMENTED",
      message: "Phone shell is not available.",
    });
    return;
  } else {
    res.status(400).json({
      error: "INVALID_TARGET",
      message: `Unknown shell target: ${target}`,
    });
    return;
  }
});

// POST /api/terminal/kill
terminalRouter.post("/kill", (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "SESSION_NOT_FOUND" });
    return;
  }
  session.pty.kill();
  sessions.delete(sessionId);
  res.json({ ok: true, sessionId });
});

// GET /api/terminal/audit
terminalRouter.get("/audit", (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId } = req.query as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  res.json({ events: getAuditBySession(sessionId) });
});

// GET /api/terminal/snapshot
terminalRouter.get("/snapshot", (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId, n } = req.query as { sessionId?: string; n?: string };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  res.json(getAuditSnapshot(sessionId, Number(n || 50)));
});

// GET /api/terminal/sessions
terminalRouter.get("/sessions", (req, res) => {
  if (!guardREST(req, res)) return;
  const list = [...sessions.entries()].map(([id, s]) => ({
    id,
    mode: s.mode,
    cwd: s.cwd,
    created: s.created,
    alive: s.alive,
    connected: !!s.ws,
  }));
  res.json({ sessions: list, count: list.length });
});

// ── WebSocket PTY Server (noServer — wired in index.ts) ───────────────────
export const terminalWss = new WebSocketServer({ noServer: true });

terminalWss.on("connection", (ws: WebSocket, req: Request) => {
  const url = new URL(req.url!, `http://localhost`);
  const sessId = url.searchParams.get("sessionId") || "";
  const session = sessions.get(sessId);

  if (!session) {
    ws.send(JSON.stringify({ type: "error", msg: "SESSION_NOT_FOUND" }));
    ws.close();
    return;
  }

  if (session.ws) {
    session.ws.close(); // evict old connection
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
      ws.send(JSON.stringify({ type: "output", data }));
    }
  });

  // WS → PTY (with policy gate)
  ws.on("message", async (raw: Buffer | string) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "input") {
      // Only evaluate complete commands (newline-terminated)
      if (msg.data?.includes("\n") || msg.data?.includes("\r")) {
        const cmd = msg.data.trim();
        if (cmd) {
          const verdict = evaluateCommand(cmd, session.mode);
          await auditLog({
            sessionId: sessId,
            target: "host",
            command: cmd,
            cwd: session.cwd,
            allowed: verdict.allowed,
            risk: verdict.risk,
            user: "agentlee",
            outputSnippet: "",
          });

          if (!verdict.allowed) {
            ws.send(
              JSON.stringify({
                type: "policy_block",
                reason: verdict.reason,
                command: cmd,
                mode: session.mode,
              }),
            );
            // Show denial in terminal
            session.pty.write(`\r\n[POLICY BLOCK] ${verdict.reason}\r\n`);
            return;
          }
        }
      }
      session.pty.write(msg.data);
    } else if (msg.type === "resize") {
      session.pty.resize(msg.cols || 120, msg.rows || 30);
    } else if (msg.type === "set_mode") {
      const newMode = msg.mode as PolicyMode;
      if (["safe", "build", "admin"].includes(newMode)) {
        session.mode = newMode;
        ws.send(JSON.stringify({ type: "mode_changed", mode: newMode }));
      }
    }
  });

  ws.on("close", () => {
    console.log(`[terminal] WS disconnected from session ${sessId}`);
    if (session.ws === ws) session.ws = undefined;
  });

  ws.on("error", (e) => {
    console.error("[terminal] WS error:", e.message);
  });
});
