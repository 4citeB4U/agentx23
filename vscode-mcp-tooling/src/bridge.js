import fs from "fs";
import http from "http";
import { spawn } from "child_process";
import { CONFIG } from "./config.js";
import { loadDotenv, mergeEnv } from "./dotenv.js";
import { run } from "./exec.js";

mergeEnv(loadDotenv(CONFIG.DOTENV_PATH));
const BRIDGE_PORT = Number(process.env.MCP_BRIDGE_PORT || process.env.PORT || 8002);

const AUTO_START = String(process.env.AUTO_START_MCPS ?? "1") !== "0";
const MAX_LOG_LINES = Number(process.env.MCP_LOG_LINES || 600);

function nowIso() {
  return new Date().toISOString();
}

function pushLog(state, line) {
  const cleaned = String(line ?? "").replace(/\r?\n$/, "");
  if (!cleaned) return;
  state.logs.push(`[${nowIso()}] ${cleaned}`);
  if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
}

function spawnProcess(cmd, args, opts = {}) {
  const { cwd, env } = opts;
  const s = String(cmd || "").toLowerCase();
  const isCmd = process.platform === "win32" && (s.endsWith(".cmd") || s.endsWith(".bat"));
  if (isCmd) {
    return spawn("cmd.exe", ["/d", "/s", "/c", "call", cmd, ...args], { cwd, env, windowsHide: true });
  }
  return spawn(cmd, args, { cwd, env, windowsHide: true });
}

const MCP_SPECS = {
  testsprite: { kind: "npm", pkg: "@testsprite/testsprite-mcp@latest" },
  playwright: { kind: "npm", pkg: "@playwright/mcp@latest" },
  insforge: { kind: "npm", pkg: "@insforge/mcp@latest" },
  stitch: { kind: "stitch" }
};

const processes = new Map();

function getOrCreateState(name) {
  if (!processes.has(name)) {
    processes.set(name, {
      name,
      running: false,
      pid: null,
      startedAt: null,
      stoppedAt: null,
      lastExitCode: null,
      lastSignal: null,
      lastError: null,
      logs: [],
      child: null
    });
  }
  return processes.get(name);
}

function listStatus() {
  const out = {};
  for (const name of Object.keys(MCP_SPECS)) {
    const s = getOrCreateState(name);
    out[name] = {
      running: Boolean(s.running),
      pid: s.pid,
      startedAt: s.startedAt,
      stoppedAt: s.stoppedAt,
      lastExitCode: s.lastExitCode,
      lastSignal: s.lastSignal,
      lastError: s.lastError
    };
  }
  return out;
}

async function startMcp(name) {
  const spec = MCP_SPECS[name];
  if (!spec) throw new Error("UNKNOWN_MCP");

  const state = getOrCreateState(name);
  if (state.running && state.child && state.pid) {
    return { ok: true, status: "already-running", ...listStatus()[name] };
  }

  // Clear previous error, keep logs
  state.lastError = null;
  state.lastExitCode = null;
  state.lastSignal = null;

  const env = { ...process.env };

  // InsForge MCP expects API_KEY + API_BASE_URL.
  // We map from common workspace env names already present in .env.local.
  if (name === "insforge") {
    if (!env.API_KEY) env.API_KEY = env.INSFORGE_TOKEN || env.INSFORGE_API_KEY || "";
    if (!env.API_BASE_URL) env.API_BASE_URL = env.INSFORGE_BASE_URL || env.INSFORGE_URL || env.INSFORGE_HOST || "http://localhost:7130";
  }
  let child;

  if (spec.kind === "npm") {
    // Start the MCP server as a long-running child (don't await).
    // On Windows, run npm.cmd directly.
    child = spawnProcess(CONFIG.NPM_CMD, ["exec", "--yes", "--", spec.pkg], { env });
  } else if (spec.kind === "stitch") {
    const cwd = CONFIG.STITCH_PATH;
    const entry = cwd + "\\\\dist\\\\index.js";
    if (!fs.existsSync(entry)) throw new Error("MISSING_STITCH_ENTRY: " + entry);
    child = spawnProcess(CONFIG.NODE_EXE, [entry], { cwd, env });
  } else {
    throw new Error("UNKNOWN_SPEC_KIND");
  }

  state.child = child;
  state.running = true;
  state.pid = child.pid;
  state.startedAt = nowIso();
  state.stoppedAt = null;

  pushLog(state, `[manager] started ${name} (pid=${child.pid})`);

  if (child.stdout) child.stdout.on("data", (d) => pushLog(state, d.toString()));
  if (child.stderr) child.stderr.on("data", (d) => pushLog(state, "[stderr] " + d.toString()));

  child.on("close", (code, signal) => {
    state.running = false;
    state.pid = null;
    state.child = null;
    state.stoppedAt = nowIso();
    state.lastExitCode = code;
    state.lastSignal = signal;
    pushLog(state, `[manager] exited ${name} (code=${code}, signal=${signal || ""})`);
  });

  child.on("error", (e) => {
    state.lastError = String(e?.message || e);
    state.running = false;
    state.pid = null;
    state.child = null;
    state.stoppedAt = nowIso();
    pushLog(state, `[manager] error ${name}: ${state.lastError}`);
  });

  return { ok: true, status: "started", ...listStatus()[name] };
}

async function stopMcp(name) {
  const spec = MCP_SPECS[name];
  if (!spec) throw new Error("UNKNOWN_MCP");

  const state = getOrCreateState(name);
  if (!state.running || !state.child) {
    return { ok: true, status: "already-stopped", ...listStatus()[name] };
  }

  try {
    pushLog(state, `[manager] stopping ${name} (pid=${state.child.pid})`);
    state.child.kill();
  } catch (e) {
    state.lastError = String(e?.message || e);
    return { ok: false, status: "stop-failed", error: state.lastError };
  }

  return { ok: true, status: "stopping" };
}

async function runPkg(pkg) {
  const env = { ...process.env };
  return await run(CONFIG.NPM_CMD, ["exec", "--yes", "--", pkg], { env });
}

async function runStitch() {
  const env = { ...process.env };
  const cwd = CONFIG.STITCH_PATH;
  const entry = cwd + "\\\\dist\\\\index.js";
  if (!fs.existsSync(entry)) return { code: 3, out: "", err: "Missing: " + entry };
  return await run(CONFIG.NODE_EXE, [entry], { cwd, env });
}

const routes = {
  "/": () => Promise.resolve({
    code: 0,
    status: "healthy",
    service: "mcp-bridge",
    port: BRIDGE_PORT,
    health: "/health",
    routes: [
      "/health",
      "/status",
      "/start/:name",
      "/stop/:name",
      "/logs/:name",
      "/run/testsprite",
      "/run/playwright",
      "/run/insforge",
      "/run/stitch"
    ]
  }),
  "/health": () => Promise.resolve({ code: 0, status: "healthy", port: BRIDGE_PORT }),
  "/status": () => Promise.resolve({ code: 0, status: "ok", port: BRIDGE_PORT, modules: listStatus() }),
  "/run/testsprite": () => runPkg("@testsprite/testsprite-mcp@latest"),
  "/run/playwright": () => runPkg("@playwright/mcp@latest"),
  "/run/insforge": () => runPkg("@insforge/mcp@latest"),
  "/run/stitch": () => runStitch()
};

const server = http.createServer(async (req, res) => {
  const send = (obj, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj, null, 2));
  };

  if (req.url === "/favicon.ico") return send({ ok: true }, 204);

  const url = new URL(req.url, `http://127.0.0.1:${BRIDGE_PORT}`);
  const pathname = url.pathname;

  // Manager endpoints
  if (pathname === "/status" && req.method === "GET") {
    return send({ ok: true, ...(await routes["/status"]()) });
  }

  if (pathname.startsWith("/start/") && req.method === "POST") {
    const name = pathname.split("/").pop();
    try {
      const r = await startMcp(name);
      return send(r, 200);
    } catch (e) {
      return send({ ok: false, error: String(e?.message || e) }, 400);
    }
  }

  if (pathname.startsWith("/stop/") && req.method === "POST") {
    const name = pathname.split("/").pop();
    try {
      const r = await stopMcp(name);
      return send(r, 200);
    } catch (e) {
      return send({ ok: false, error: String(e?.message || e) }, 400);
    }
  }

  if (pathname.startsWith("/logs/") && req.method === "GET") {
    const name = pathname.split("/").pop();
    const state = getOrCreateState(name);
    const tail = Math.max(1, Math.min(500, Number(url.searchParams.get("tail") || "150")));
    const slice = state.logs.slice(-tail);
    return send({ ok: true, name, running: state.running, pid: state.pid, lines: slice.length, logs: slice }, 200);
  }

  // Legacy run endpoints + health (compat)
  if (req.method !== "POST" && pathname !== "/health" && pathname !== "/") return send({ ok: false, error: "POST only" }, 405);

  const fn = routes[pathname];
  if (!fn) return send({ ok: false, error: "Unknown route" }, 404);

  const r = await fn();
  send({ ok: r.code === 0, ...r });
});

server.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   Agent Lee Studio - MCP Bridge");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`   Port: ${BRIDGE_PORT}`);
  console.log(`   Health: http://127.0.0.1:${BRIDGE_PORT}/health`);
  console.log("   Routes:");
  console.log(`   • POST http://127.0.0.1:${BRIDGE_PORT}/run/testsprite`);
  console.log(`   • POST http://127.0.0.1:${BRIDGE_PORT}/run/playwright`);
  console.log(`   • POST http://127.0.0.1:${BRIDGE_PORT}/run/insforge`);
  console.log(`   • POST http://127.0.0.1:${BRIDGE_PORT}/run/stitch`);
  console.log("═══════════════════════════════════════════════════════");

  if (AUTO_START) {
    for (const name of Object.keys(MCP_SPECS)) {
      startMcp(name).catch((e) => {
        const s = getOrCreateState(name);
        s.lastError = String(e?.message || e);
        pushLog(s, `[manager] auto-start failed ${name}: ${s.lastError}`);
      });
    }
  }
});
