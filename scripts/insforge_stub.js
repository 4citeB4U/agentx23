// LEEWAY v12 HEADER
// File: scripts/insforge_stub.js
// Purpose: InsForge bridge stub — lightweight HTTP relay to InsForge SDK.
//          Bridges Agent Lee backend calls to InsForge project/table APIs.
//          Used by AgentLee-InsForgeBridge PM2 process (port 7007).
// Security: Handshake-guarded endpoints; no direct filesystem exposure.
// Performance: Single-file; zero-dependency (uses built-in http module).
// Discovery: ROLE=bridge; INTENT=insforge-relay; REGION=🔗 InsForge

import http from "http";
import https from "https";
import { URL } from "url";

const PORT = Number(process.env.INSFORGE_STUB_PORT || 7007);
const NEURAL_HANDSHAKE =
  process.env.NEURAL_HANDSHAKE ||
  process.env.NEURAL_HANDSHAKE_KEY ||
  "AGENT_LEE_SOVEREIGN_V1";
const INSFORGE_URL =
  process.env.INSFORGE_URL || "https://3c4cp27v.us-west.insforge.app";
const INSFORGE_ANON_KEY = process.env.INSFORGE_ANON_KEY || "";

// ── Security guard ────────────────────────────────────────────────────────
function guardRequest(req) {
  const handshake =
    req.headers["x-neural-handshake"] ||
    (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  return handshake === NEURAL_HANDSHAKE;
}

// ── Proxy helper — forward to InsForge ───────────────────────────────────
function proxyToInsForge(targetPath, body, res) {
  try {
    const parsed = new URL(INSFORGE_URL);
    const isHttps = parsed.protocol === "https:";
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: targetPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
        apikey: INSFORGE_ANON_KEY,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const transport = isHttps ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => (data += chunk));
      proxyRes.on("end", () => {
        res.writeHead(proxyRes.statusCode, {
          "Content-Type": "application/json",
        });
        res.end(data);
      });
    });
    proxyReq.on("error", (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    });
    proxyReq.write(body);
    proxyReq.end();
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  // Health check — no auth required
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        status: "insforge-stub: ok",
        port: PORT,
        insforge_url: INSFORGE_URL,
        anon_key_configured: Boolean(INSFORGE_ANON_KEY),
        ts: Date.now(),
      }),
    );
  }

  // All other routes require handshake
  if (!guardRequest(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "INVALID_HANDSHAKE" }));
  }

  // Collect body
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    // /api/insforge/query → proxy to InsForge REST
    if (req.method === "POST" && pathname === "/api/insforge/query") {
      return proxyToInsForge("/rest/v1/rpc/query", body, res);
    }
    // /api/insforge/upsert → InsForge upsert
    if (req.method === "POST" && pathname === "/api/insforge/upsert") {
      return proxyToInsForge("/rest/v1/rpc/upsert", body, res);
    }
    // Echo back anything else (stub mode)
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        stub: true,
        path: pathname,
        body: body ? JSON.parse(body) : null,
      }),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[insforge-stub] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[insforge-stub] InsForge target: ${INSFORGE_URL}`);
  console.log(
    `[insforge-stub] Anon key configured: ${Boolean(INSFORGE_ANON_KEY)}`,
  );
});

server.on("error", (e) => {
  console.error(`[insforge-stub] Server error: ${e.message}`);
  process.exit(1);
});
