// ============================================================================
// LEEWAY HEADER — DO NOT REMOVE
// File: backend/src/routes/mcpBrowser.ts
// Purpose: Proxy routes for Browser MCP agent. Forwards authenticated
//          requests from the Agent Lee UI to the local browser-mcp service
//          running on port 7009 (Playwright headless browser in the VM).
// Security: Relies on securityMiddleware (x-neural-handshake) already applied
//           at the /api level in index.ts.
// Discovery: ROLE=internal; INTENT=browser-mcp-proxy; REGION=🌐 BROWSER
// ============================================================================

import { Request, Response, Router } from "express";
import http from "http";

export const mcpBrowserRouter = Router();

const BROWSER_MCP_PORT = Number(process.env.BROWSER_MCP_PORT || 7009);
const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";

function proxyGet(remotePath: string, res: Response): void {
  const req = http.get(
    {
      host: "127.0.0.1",
      port: BROWSER_MCP_PORT,
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
        .json({ error: "browser-mcp unavailable", detail: err.message });
  });
  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent)
      res.status(504).json({ error: "browser-mcp timeout" });
  });
}

function proxyPost(remotePath: string, body: unknown, res: Response): void {
  const payload = JSON.stringify(body);
  const options = {
    host: "127.0.0.1",
    port: BROWSER_MCP_PORT,
    path: remotePath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "x-neural-handshake": HANDSHAKE,
    },
    timeout: 30000,
  };
  const req = http.request(options, (upstream) => {
    res.status(upstream.statusCode || 200);
    upstream.pipe(res);
  });
  req.on("error", (err) => {
    if (!res.headersSent)
      res
        .status(502)
        .json({ error: "browser-mcp unavailable", detail: err.message });
  });
  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent)
      res.status(504).json({ error: "browser-mcp timeout" });
  });
  req.write(payload);
  req.end();
}

// GET /api/mcp/browser/health — liveness check (no auth)
mcpBrowserRouter.get("/health", (_req: Request, res: Response) => {
  const req = http.get(
    {
      host: "127.0.0.1",
      port: BROWSER_MCP_PORT,
      path: "/health",
      timeout: 5000,
    },
    (upstream) => {
      upstream.pipe(res);
    },
  );
  req.on("error", () => res.status(502).json({ error: "browser-mcp offline" }));
  req.on("timeout", () => {
    req.destroy();
    res.status(504).json({ error: "browser-mcp timeout" });
  });
});

// GET /api/mcp/browser/status — list recent browser jobs
mcpBrowserRouter.get("/status", (_req: Request, res: Response) => {
  proxyGet("/status", res);
});

// POST /api/mcp/browser/navigate — open a URL and return page metadata
// Body: { url: string }
mcpBrowserRouter.post("/navigate", (req: Request, res: Response) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" }) as unknown as void;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res
        .status(400)
        .json({ error: "Only http/https URLs allowed" }) as unknown as void;
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL" }) as unknown as void;
  }
  proxyPost("/navigate", { url }, res);
});

// POST /api/mcp/browser/scrape — full page content extraction
// Body: { url: string }
mcpBrowserRouter.post("/scrape", (req: Request, res: Response) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" }) as unknown as void;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res
        .status(400)
        .json({ error: "Only http/https URLs allowed" }) as unknown as void;
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL" }) as unknown as void;
  }
  proxyPost("/scrape", { url }, res);
});

// GET /api/mcp/browser/jobs/:id — poll a browser job by id
mcpBrowserRouter.get("/jobs/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  if (!/^bj-\d+-\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid job id" }) as unknown as void;
  }
  proxyGet(`/jobs/${id}`, res);
});
