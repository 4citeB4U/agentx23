import { exec } from "child_process";
import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { aiService } from "../services/ai.js";
import { healthService } from "../services/health.js";
import { loggerService } from "../services/logger.js";
import { systemStatusService } from "../services/systemStatus.js";

const execAsync = promisify(exec);

export const servicesRouter = Router();

async function readRuntimeConfig(): Promise<any | null> {
  const candidates = [
    path.resolve(process.cwd(), "ui.runtime.json"),
    path.resolve(process.cwd(), "..", "ui.runtime.json"),
  ];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return null;
}

// Runtime config (truthful bridges for REAL VS Code / Anti-Gravity URLs)
// Intended to be written by local bootstrap scripts; safe to read from UI.
servicesRouter.get("/runtime", async (req, res) => {
  try {
    const cfg = await readRuntimeConfig();
    res.json({
      updatedAt: cfg?.updatedAt || null,
      vscodeReal: cfg?.vscodeReal || null,
      antiGravityReal: cfg?.antiGravityReal || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get internal system telemetry (Port health + AI health)
servicesRouter.get("/telemetry", async (req, res) => {
  try {
    const systemHealth = healthService.getSystemStatus();
    const aiHealth = aiService.getHealth();

    res.json({
      ...systemHealth,
      ai: aiHealth,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy status endpoint (kept for backward compatibility, but enhanced)
servicesRouter.get("/status", async (req, res) => {
  const status = healthService.getSystemStatus();
  res.json(status);
});

// Health check endpoint (lightweight check for neutral handshake verification)
servicesRouter.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Agent System Status (schema-shaped)
// Used by UI to validate handshake and by the deterministic capabilities responder.
servicesRouter.get("/system-status", async (req, res) => {
  try {
    const handshake =
      typeof req.headers["x-neural-handshake"] === "string"
        ? req.headers["x-neural-handshake"]
        : undefined;
    const status = await systemStatusService.getStatus(handshake);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// Track mesh export
servicesRouter.post("/track-export", async (req, res) => {
  const { meshId, format } = req.body;
  await loggerService.log("export", `Mesh export: ${meshId}`, { format });
  res.json({ status: "logged", meshId });
});

// ── System Health Aggregator (polls all layers, used by Diagnostics Panel) ──
let dnsCacheState: {
  resolved: boolean;
  hostname: string;
  since: string | null;
} | null = null;

async function pingService(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    return r.ok;
  } catch {
    return false;
  }
}

servicesRouter.get("/system/health", async (req, res) => {
  const [brain, gateway, desktop, mcp] = await Promise.all([
    pingService("http://localhost:8004/health"),
    pingService("http://localhost:8101/health").catch(() => false),
    pingService("http://localhost:8005/status"),
    pingService("http://localhost:8002/health").catch(() => false),
  ]);

  res.json({
    timestamp: Date.now(),
    version: "agent-lee-rev2",
    services: {
      backend: true,
      brain,
      gateway,
      desktop,
      mcp,
    },
    dns: dnsCacheState
      ? {
          hostname: dnsCacheState.hostname,
          resolved: dnsCacheState.resolved,
          since: dnsCacheState.since,
        }
      : { resolved: null, hostname: null },
    voice: {
      state: "PRIMARY", // populated by ttsEnforcer when imported
      engine: "edge-tts + Gemini Pro",
    },
    identity: "AGENT_LEE_SOVEREIGN_V1",
  });
});

// DNS status push from dns-monitor service
servicesRouter.post("/system/dns-status", (req, res) => {
  dnsCacheState = req.body as typeof dnsCacheState;
  res.json({ ok: true });
});

// ── Appliance Status Dashboard ─────────────────────────────────────────────
// Handshake-gated. Returns full Pi-Appliance subsystem snapshot.
servicesRouter.get("/appliance-status", async (req, res) => {
  try {
    // Lazy-import new services to avoid circular deps at module load
    const { liteMode } = await import("../services/LiteMode.js");
    const { concurrencyGuard } =
      await import("../services/ConcurrencyGuard.js");
    const { watchdogService } = await import("../services/WatchdogService.js");

    const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";
    const handshake = req.headers["x-neural-handshake"];
    if (handshake !== HANDSHAKE) {
      return res.status(401).json({ error: "INVALID_HANDSHAKE" });
    }

    const CANONICAL = process.env.CANONICAL_MEMORY_BASE_URL || "";
    let canonicalConnected = false;
    if (CANONICAL) {
      try {
        const r = await fetch(`${CANONICAL}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        canonicalConnected = r.ok;
      } catch {
        /* ignore */
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      liteMode: liteMode.status(),
      concurrency: concurrencyGuard.status(),
      watchdog: watchdogService.report(),
      canonical_memory_connected: canonicalConnected,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Lite Mode Status (public-safe) ─────────────────────────────────────────
servicesRouter.get("/lite-mode", async (_req, res) => {
  try {
    const { liteMode } = await import("../services/LiteMode.js");
    res.json(liteMode.status());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
