// ============================================================================
// LEEWAY HEADER — DO NOT REMOVE
// File: services/dashboard-mcp/index.js
// Purpose: Agent Lee Dashboard MCP — polls PM2 + backend health, exposes a
//          simple REST API that the AgentLee-Backend proxies as /api/mcp/dashboard.
// Port: 7008
// Security: x-neural-handshake required on all non-health routes.
// Discovery: ROLE=internal; INTENT=dashboard-mcp; REGION=📊 DASHBOARD
// ============================================================================

import { execFile } from "child_process";
import express from "express";
import http from "http";

const PORT = Number(process.env.DASHBOARD_MCP_PORT || 7008);
const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 7001);

const app = express();
app.use(express.json());

// ── Cached state ────────────────────────────────────────────────────────────
let agentCache = [];
let cacheTs = 0;
const CACHE_TTL_MS = 15_000; // refresh every 15 s

// ── Auth guard ──────────────────────────────────────────────────────────────
function requireHandshake(req, res, next) {
  const h = req.headers["x-neural-handshake"];
  if (h !== HANDSHAKE) return res.status(403).json({ error: "Forbidden" });
  next();
}

// ── Fetch PM2 process list ───────────────────────────────────────────────────
function fetchPm2() {
  return new Promise((resolve) => {
    execFile("pm2", ["jlist"], { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve([]);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve([]);
      }
    });
  });
}

// ── Fetch backend /api/services/system-status ────────────────────────────────
function fetchBackendStatus() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port: BACKEND_PORT,
        path: "/api/services/system-status",
        headers: { "x-neural-handshake": HANDSHAKE },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

// ── Refresh cache ────────────────────────────────────────────────────────────
async function refresh() {
  const [pm2List, backendStatus] = await Promise.all([
    fetchPm2(),
    fetchBackendStatus(),
  ]);

  agentCache = pm2List.map((p) => ({
    name: p.name,
    pid: p.pid,
    status: p.pm2_env?.status || "unknown",
    restarts: p.pm2_env?.restart_time || 0,
    uptime: p.pm2_env?.pm_uptime || null,
    cpu: p.monit?.cpu ?? null,
    mem: p.monit?.memory ?? null,
  }));

  cacheTs = Date.now();
  return { agents: agentCache, backend: backendStatus };
}

// Auto-refresh every 15 s
setInterval(refresh, CACHE_TTL_MS);
// Warm up immediately
refresh().catch(() => {});

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "dashboard-mcp: ok", port: PORT, ts: Date.now() });
});

// GET /agents — list all PM2-managed Agent Lee processes
app.get("/agents", requireHandshake, async (req, res) => {
  if (Date.now() - cacheTs > CACHE_TTL_MS) await refresh();
  res.json({ agents: agentCache, cachedAt: new Date(cacheTs).toISOString() });
});

// GET /metrics — backend system status pass-through
app.get("/metrics", requireHandshake, async (req, res) => {
  const result = await fetchBackendStatus();
  res.json(result || { error: "backend unavailable" });
});

// POST /restart — trigger a PM2 restart for a named service
app.post("/restart", requireHandshake, (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: "Invalid service name" });
  }
  execFile("pm2", ["restart", name], { timeout: 10000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: String(err.message) });
    refresh().catch(() => {});
    res.json({ ok: true, output: stdout.trim() });
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[dashboard-mcp] Listening on http://127.0.0.1:${PORT}`);
});
