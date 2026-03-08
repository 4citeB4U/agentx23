// ============================================================================
// LEEWAY HEADER — DO NOT REMOVE
// File: backend/src/routes/mcpDashboard.ts
// Purpose: Proxy routes for Dashboard MCP agent. Forwards authenticated
//          requests from the Agent Lee UI to the local dashboard-mcp service
//          running on port 7008.
// Security: Relies on securityMiddleware (x-neural-handshake) already applied
//           at the /api level in index.ts.
// Discovery: ROLE=internal; INTENT=dashboard-mcp-proxy; REGION=📊 DASHBOARD
// ============================================================================

import { Request, Response, Router } from "express";
import http from "http";

export const mcpDashboardRouter = Router();

const DASHBOARD_MCP_PORT = Number(process.env.DASHBOARD_MCP_PORT || 7008);
const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";

function proxyGet(remotePath: string, res: Response): void {
  const req = http.get(
    {
      host: "127.0.0.1",
      port: DASHBOARD_MCP_PORT,
      path: remotePath,
      headers: { "x-neural-handshake": HANDSHAKE },
      timeout: 8000,
    },
    (upstream) => {
      res.status(upstream.statusCode || 200);
      upstream.pipe(res);
    },
  );
  req.on("error", (err) => {
    if (!res.headersSent)
      res
        .status(502)
        .json({ error: "dashboard-mcp unavailable", detail: err.message });
  });
  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent)
      res.status(504).json({ error: "dashboard-mcp timeout" });
  });
}

function proxyPost(remotePath: string, body: unknown, res: Response): void {
  const payload = JSON.stringify(body);
  const options = {
    host: "127.0.0.1",
    port: DASHBOARD_MCP_PORT,
    path: remotePath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "x-neural-handshake": HANDSHAKE,
    },
    timeout: 10000,
  };
  const req = http.request(options, (upstream) => {
    res.status(upstream.statusCode || 200);
    upstream.pipe(res);
  });
  req.on("error", (err) => {
    if (!res.headersSent)
      res
        .status(502)
        .json({ error: "dashboard-mcp unavailable", detail: err.message });
  });
  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent)
      res.status(504).json({ error: "dashboard-mcp timeout" });
  });
  req.write(payload);
  req.end();
}

// GET /api/mcp/dashboard/health — liveness check (no auth — forwarded to public /health)
mcpDashboardRouter.get("/health", (_req: Request, res: Response) => {
  const req = http.get(
    {
      host: "127.0.0.1",
      port: DASHBOARD_MCP_PORT,
      path: "/health",
      timeout: 5000,
    },
    (upstream) => {
      upstream.pipe(res);
    },
  );
  req.on("error", () =>
    res.status(502).json({ error: "dashboard-mcp offline" }),
  );
  req.on("timeout", () => {
    req.destroy();
    res.status(504).json({ error: "dashboard-mcp timeout" });
  });
});

// GET /api/mcp/dashboard/agents — list all PM2 Agent Lee processes
mcpDashboardRouter.get("/agents", (_req: Request, res: Response) => {
  proxyGet("/agents", res);
});

// GET /api/mcp/dashboard/metrics — system metrics from backend
mcpDashboardRouter.get("/metrics", (_req: Request, res: Response) => {
  proxyGet("/metrics", res);
});

// POST /api/mcp/dashboard/restart — restart a named PM2 service
mcpDashboardRouter.post("/restart", (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res
      .status(400)
      .json({ error: "Invalid service name" }) as unknown as void;
  }
  proxyPost("/restart", { name }, res);
});
