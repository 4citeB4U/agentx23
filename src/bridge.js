import http from "http";
import { CONFIG } from "./config.js";
import { loadDotenv, mergeEnv } from "./dotenv.js";
import { run } from "./exec.js";
import fs from "fs";

mergeEnv(loadDotenv(CONFIG.DOTENV_PATH));
const BRIDGE_PORT = Number(process.env.MCP_BRIDGE_PORT || process.env.PORT || 8002);

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
  "/run/testsprite": () => runPkg("@testsprite/testsprite-mcp@latest"),
  "/run/playwright": () => runPkg("@playwright/mcp@latest"),
  "/run/insforge":   () => runPkg("@insforge/mcp@latest"),
  "/run/stitch":     () => runStitch()
};

const server = http.createServer(async (req, res) => {
  const send = (obj, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj, null, 2));
  };

  if (req.method !== "POST") return send({ ok: false, error: "POST only" }, 405);

  const fn = routes[req.url];
  if (!fn) return send({ ok: false, error: "Unknown route" }, 404);

  const r = await fn();
  send({ ok: r.code === 0, ...r });
});

server.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.log(`Bridge listening on http://127.0.0.1:${BRIDGE_PORT}`);
});
