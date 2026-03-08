/**
 * TUNNEL MANAGER — cloudflared Quick Tunnel
 * Wraps cloudflared, captures the public HTTPS URL from its output,
 * and exposes it on http://localhost:4040/api/tunnels  (ngrok-compatible API)
 * so the existing send_telegram_link.py works unchanged.
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const CLOUDFLARED =
  process.env.CLOUDFLARED_PATH || "C:\\Tools\\cloudflared.exe";
const LOCAL_PORT = Number(process.env.TARGET_PORT || process.env.PORT || 6000);
const API_PORT = Number(process.env.TUNNEL_API_PORT || 4040);
const URL_FILE = path.join(__dirname, "..", "workspace", "tunnel_url.txt");

let publicUrl = null;
let tunnelProc = null;
let logLines = [];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
  if (logLines.length > 200) logLines.shift();
}

function startTunnel() {
  log(`Starting cloudflared tunnel → http://localhost:${LOCAL_PORT}`);

  tunnelProc = spawn(
    CLOUDFLARED,
    ["tunnel", "--url", `http://localhost:${LOCAL_PORT}`],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  const handleLine = (line) => {
    logLines.push(line);
    if (logLines.length > 200) logLines.shift();

    // cloudflared prints the URL in lines like:
    //   INF Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): https://...
    //   INF | https://xxx.trycloudflare.com
    const urlMatch =
      line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i) ||
      line.match(
        /https:\/\/[a-z0-9.-]+\.(cfargotunnel\.com|trycloudflare\.com|cloudflare\.com)[^\s"]*/i,
      );
    if (urlMatch) {
      publicUrl = urlMatch[0].trim();
      log(`✅ Tunnel active: ${publicUrl}`);

      // Write URL to file so other processes can read it
      try {
        fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });
        fs.writeFileSync(URL_FILE, publicUrl, "utf8");
        log(`URL written to ${URL_FILE}`);
      } catch (e) {
        log(`⚠️  Could not write URL file: ${e.message}`);
      }
    }
  };

  tunnelProc.stdout.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach(handleLine),
  );
  tunnelProc.stderr.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach(handleLine),
  );

  tunnelProc.on("exit", (code, signal) => {
    log(
      `cloudflared exited (code=${code}, signal=${signal}). Restarting in 5s...`,
    );
    publicUrl = null;
    setTimeout(startTunnel, 5000);
  });

  tunnelProc.on("error", (e) => {
    log(`cloudflared spawn error: ${e.message}`);
  });
}

// ── ngrok-compatible HTTP API ─────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/api/tunnels" || req.url === "/api/tunnels/") {
    const payload = publicUrl
      ? {
          tunnels: [
            {
              name: "agent-lee-cloudflared",
              public_url: publicUrl,
              proto: "https",
              config: { addr: `localhost:${LOCAL_PORT}` },
            },
          ],
        }
      : { tunnels: [] };
    res.writeHead(200);
    res.end(JSON.stringify(payload));
    return;
  }

  if (req.url === "/status") {
    res.writeHead(200);
    res.end(
      JSON.stringify({ active: !!publicUrl, url: publicUrl, port: LOCAL_PORT }),
    );
    return;
  }

  if (req.url === "/logs") {
    res.writeHead(200);
    res.end(JSON.stringify({ lines: logLines }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "NOT_FOUND" }));
});

server.listen(API_PORT, "127.0.0.1", () => {
  log(`Tunnel manager API listening on http://127.0.0.1:${API_PORT}`);
  log(`  GET /api/tunnels  — ngrok-compatible tunnel list`);
  log(`  GET /status       — quick status`);
  startTunnel();
});

// Graceful shutdown
["SIGINT", "SIGTERM"].forEach((sig) => {
  process.on(sig, () => {
    if (tunnelProc) tunnelProc.kill();
    server.close();
    process.exit(0);
  });
});
