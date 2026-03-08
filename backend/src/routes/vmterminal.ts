/**
 * Agent Lee — VM Terminal Route (SSH-backed)
 * Layer 30: VSCodeBridge | LEEWAY-CORE-2026
 *
 * REST:
 *   POST /api/vmterminal/session       → { sessionId }
 *   POST /api/vmterminal/kill          → { ok }
 *   GET  /api/vmterminal/audit         → audit events
 *   GET  /api/vmterminal/snapshot      → last N lines + hashes
 *   GET  /api/vmterminal/status        → SSH config + session count
 *
 * WebSocket (wired via index.ts upgrade):
 *   WS /api/vmterminal/ws?sessionId=   → interactive SSH PTY stream
 */

import crypto from "crypto";
import { Request, Response, Router } from "express";
import fs from "fs";
import { Client as SSHClient, type Channel, type ConnectConfig } from "ssh2";
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

const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";

// SSH defaults from env (provision-agentlee-vm.ps1 sets these)
const VM_HOST = process.env.VM_HOST || "localhost";
const VM_PORT = Number(process.env.VM_PORT || 22);
const VM_USER = process.env.VM_USER || "agentlee";
const VM_KEY = process.env.VM_SSH_KEY; // undefined → password auth
const VM_PASSWORD = process.env.VM_PASSWORD;

// ── Session Registry ───────────────────────────────────────────────────────
interface VmSession {
  id: string;
  ssh: SSHClient;
  channel: Channel | null;
  mode: PolicyMode;
  ws?: WebSocket;
  created: string;
  alive: boolean;
  outputBuf: string;
}

const sessions = new Map<string, VmSession>();

// ── Helpers ───────────────────────────────────────────────────────────────
function guardREST(req: Request, res: Response): boolean {
  const h = req.headers["x-neural-handshake"] || req.headers["authorization"];
  if (h !== HANDSHAKE && h !== `Bearer ${HANDSHAKE}`) {
    res.status(401).json({ error: "INVALID_HANDSHAKE" });
    return false;
  }
  return true;
}

function buildSSHConfig(override?: Partial<ConnectConfig>): ConnectConfig {
  const cfg: ConnectConfig = {
    host: VM_HOST,
    port: VM_PORT,
    username: VM_USER,
    readyTimeout: 10_000,
    ...override,
  };
  if (VM_KEY && fs.existsSync(VM_KEY)) {
    cfg.privateKey = fs.readFileSync(VM_KEY);
  } else if (VM_PASSWORD) {
    cfg.password = VM_PASSWORD;
  } else {
    // Fallback: if no key or password, try agent-based auth
    cfg.agent = process.env.SSH_AUTH_SOCK;
  }
  return cfg;
}

// ── Router ────────────────────────────────────────────────────────────────
export const vmterminalRouter = Router();

// POST /api/vmterminal/session
vmterminalRouter.post("/session", (req, res) => {
  if (!guardREST(req, res)) return;
  const sessionId = crypto.randomUUID();
  const mode: PolicyMode = (req.body?.mode as PolicyMode) || "safe";

  const ssh = new SSHClient();
  const session: VmSession = {
    id: sessionId,
    ssh,
    channel: null,
    mode,
    created: new Date().toISOString(),
    alive: false,
    outputBuf: "",
  };
  sessions.set(sessionId, session);

  ssh.on("ready", () => {
    session.alive = true;
    console.log(`[vmterminal] SSH connected — session ${sessionId}`);
    res.json({ sessionId, mode, vmHost: VM_HOST, vmUser: VM_USER });
  });

  ssh.on("error", (err) => {
    sessions.delete(sessionId);
    if (!res.headersSent) {
      res
        .status(502)
        .json({ error: "SSH_CONNECT_FAILED", detail: err.message });
    }
  });

  ssh.on("close", () => {
    session.alive = false;
    session.channel = null;
    session.ws?.close();
    sessions.delete(sessionId);
    console.log(`[vmterminal] SSH closed — session ${sessionId}`);
  });

  const sshCfg = buildSSHConfig({
    host: req.body?.vmHost || VM_HOST,
    port: req.body?.vmPort || VM_PORT,
    username: req.body?.vmUser || VM_USER,
  });

  ssh.connect(sshCfg);
});

// POST /api/vmterminal/kill
vmterminalRouter.post("/kill", (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "SESSION_NOT_FOUND" });
    return;
  }
  session.channel?.close();
  const sshClient = session.ssh;
  if (sshClient && typeof (sshClient as any).end === "function") {
    (sshClient as any).end();
  }
  sessions.delete(sessionId);
  res.json({ ok: true, sessionId });
});

// GET /api/vmterminal/audit
vmterminalRouter.get("/audit", (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId } = req.query as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  res.json({ events: getAuditBySession(sessionId) });
});

// GET /api/vmterminal/snapshot
vmterminalRouter.get("/snapshot", (req, res) => {
  if (!guardREST(req, res)) return;
  const { sessionId, n } = req.query as { sessionId?: string; n?: string };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  res.json(getAuditSnapshot(sessionId, Number(n || 50)));
});

// GET /api/vmterminal/status
vmterminalRouter.get("/status", (req, res) => {
  if (!guardREST(req, res)) return;
  const list = [...sessions.entries()].map(([id, s]) => ({
    id,
    mode: s.mode,
    alive: s.alive,
    connected: !!s.ws,
    created: s.created,
  }));
  res.json({
    vmHost: VM_HOST,
    vmPort: VM_PORT,
    vmUser: VM_USER,
    authMethod: VM_KEY ? "key" : VM_PASSWORD ? "password" : "agent",
    wslFallback: VM_HOST === "localhost" && !VM_PASSWORD && !VM_KEY,
    sessions: list,
    count: list.length,
  });
});

// ── WebSocket SSH PTY (noServer — wired in index.ts) ─────────────────────
export const vmterminalWss = new WebSocketServer({ noServer: true });

vmterminalWss.on("connection", (ws: WebSocket, req: Request) => {
  const url = new URL(req.url!, `http://localhost`);
  const sessId = url.searchParams.get("sessionId") || "";
  const session = sessions.get(sessId);

  if (!session || !session.alive) {
    ws.send(
      JSON.stringify({ type: "error", msg: "SESSION_NOT_FOUND_OR_DEAD" }),
    );
    ws.close();
    return;
  }

  if (session.ws) session.ws.close();
  session.ws = ws;

  const cols = Number(url.searchParams.get("cols") || 120);
  const rows = Number(url.searchParams.get("rows") || 30);

  // Open SSH shell channel (guard in case ssh client is unexpectedly undefined)
  const sshClient = session.ssh;
  if (!sshClient) {
    ws.send(JSON.stringify({ type: "error", msg: "SSH_CLIENT_UNAVAILABLE" }));
    ws.close();
    return;
  }
  if (typeof (sshClient as any).shell !== "function") {
    ws.send(JSON.stringify({ type: "error", msg: "SSH_CLIENT_NO_SHELL" }));
    ws.close();
    return;
  }
  (sshClient as any).shell(
    { term: "xterm-256color", cols, rows },
    (err: any, channel: any) => {
      if (err) {
        ws.send(JSON.stringify({ type: "error", msg: err.message }));
        ws.close();
        return;
      }

      session.channel = channel;
      console.log(`[vmterminal] Shell channel open — session ${sessId}`);

      // SSH → WS
      channel.on("data", (data: Buffer) => {
        const text = data.toString("utf8");
        session.outputBuf += text;
        if (session.outputBuf.length > 10_240) {
          session.outputBuf = session.outputBuf.slice(-10_240);
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "output", data: text }));
        }
      });

      if (channel.stderr) {
        channel.stderr.on("data", (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "output", data: data.toString() }));
          }
        });
      }

      channel.on("close", () => {
        session.channel = null;
        ws.close();
      });

      // WS → SSH (with policy gate)
      ws.on("message", async (raw: Buffer | string) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "input") {
          if (msg.data?.includes("\n") || msg.data?.includes("\r")) {
            const cmd = msg.data.trim();
            if (cmd) {
              const verdict = evaluateCommand(cmd, session.mode);
              await auditLog({
                sessionId: sessId,
                target: "vm",
                command: cmd,
                cwd: "~",
                allowed: verdict.allowed,
                risk: verdict.risk,
                user: VM_USER,
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
                channel.write(
                  `\r\necho "[POLICY BLOCK] ${verdict.reason?.replace(/"/g, "")}";\r\n`,
                );
                return;
              }
            }
          }
          channel.write(msg.data);
        } else if (msg.type === "resize") {
          channel.setWindow(msg.cols || 120, msg.rows || 30, 0, 0);
        } else if (msg.type === "set_mode") {
          if (["safe", "build", "admin"].includes(msg.mode)) {
            session.mode = msg.mode as PolicyMode;
            ws.send(
              JSON.stringify({ type: "mode_changed", mode: session.mode }),
            );
          }
        }
      });
    },
  );

  ws.on("close", () => {
    console.log(`[vmterminal] WS disconnected from session ${sessId}`);
    if (session.ws === ws) session.ws = undefined;
    session.channel?.close();
  });

  ws.on("error", (e) => console.error("[vmterminal] WS error:", e.message));
});
