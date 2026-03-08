// LEEWAY v12 HEADER
// File: backend/src/services/WatchdogService.ts
// Purpose: Three watchdog loops — Process, Health, and Drift/Latency.
// Runs in-process. Uses native fetch with AbortController for clean 2s timeouts.
// All state changes propagate through LiteMode and TelemetryService.

import { liteMode } from "./LiteMode.js";

interface ServiceHealth {
  name: string;
  url: string;
  status: "online" | "offline" | "unknown";
  latencyMs: number | null;
  lastChecked: string;
  consecutiveMisses: number;
}

interface WatchdogReport {
  process: { lastRun: string; services: ServiceHealth[] };
  health: { lastRun: string; services: ServiceHealth[] };
  drift: {
    lastRun: string;
    latencyMs: number | null;
    liteModeActive: boolean;
    consecutiveRecoveries: number;
  };
}

const CORE_SERVICES = [
  {
    name: "Backend",
    url: `http://127.0.0.1:${process.env.PORT || 7001}/health`,
  },
  {
    name: "Neural Router",
    url: `http://127.0.0.1:${process.env.NEURAL_ROUTER_PORT || 7004}/health`,
  },
];

const OPTIONAL_SERVICES = [
  { name: "MCP Bridge", url: "http://127.0.0.1:7002/health" },
  {
    name: "Cerebral",
    url: `http://127.0.0.1:${process.env.CEREBRAL_PORT || 8200}/health`,
  },
];

const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";

async function probeUrl(
  url: string,
  timeoutMs = 2000,
): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    return { ok: res.ok || res.status === 426, latencyMs: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

class WatchdogService {
  private healthState: Map<string, ServiceHealth> = new Map();
  private driftBaseline: number | null = null;
  private consecutiveRecoveries = 0;
  private driftLatencyMs: number | null = null;
  private lastDriftRun = "";
  private lastHealthRun = "";
  private lastProcessRun = "";
  private processTimers: NodeJS.Timeout[] = [];

  private initService(s: { name: string; url: string }): ServiceHealth {
    return {
      name: s.name,
      url: s.url,
      status: "unknown",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      consecutiveMisses: 0,
    };
  }

  // ── A) Process watchdog — every 10 s ─────────────────────────────────────
  private async runProcessWatchdog(): Promise<void> {
    this.lastProcessRun = new Date().toISOString();
    for (const svc of CORE_SERVICES) {
      if (!this.healthState.has(svc.name)) {
        this.healthState.set(svc.name, this.initService(svc));
      }
      const entry = this.healthState.get(svc.name)!;
      let ok = false;
      // Retry up to 3 times with exponential backoff
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await probeUrl(svc.url, 3000);
        if (result.ok) {
          ok = true;
          entry.latencyMs = result.latencyMs;
          break;
        }
        await new Promise((r) => setTimeout(r, 3000 * Math.pow(2, attempt)));
      }
      entry.lastChecked = new Date().toISOString();
      if (ok) {
        entry.consecutiveMisses = 0;
        entry.status = "online";
      } else {
        entry.consecutiveMisses++;
        entry.status = "offline";
        if (entry.consecutiveMisses >= 3 && !liteMode.isActive()) {
          liteMode.activate(`${svc.name} unreachable after 3 attempts`);
          console.warn(
            `[Watchdog/Process] ${svc.name} down — Lite Mode activated`,
          );
        }
      }
    }
  }

  // ── B) Health watchdog — every 15 s ──────────────────────────────────────
  private async runHealthWatchdog(): Promise<void> {
    this.lastHealthRun = new Date().toISOString();
    const all = [...CORE_SERVICES, ...OPTIONAL_SERVICES];
    for (const svc of all) {
      if (!this.healthState.has(svc.name)) {
        this.healthState.set(svc.name, this.initService(svc));
      }
      const entry = this.healthState.get(svc.name)!;
      const result = await probeUrl(svc.url, 2000);
      entry.lastChecked = new Date().toISOString();
      entry.latencyMs = result.latencyMs;

      if (result.ok) {
        if (entry.status === "offline") {
          console.info(`[Watchdog/Health] ${svc.name} recovered`);
        }
        entry.consecutiveMisses = 0;
        entry.status = "online";
      } else {
        entry.consecutiveMisses++;
        if (entry.consecutiveMisses >= 2) {
          entry.status = "offline";
        }
      }
    }
  }

  // ── C) Drift / Latency watchdog — every 30 s ─────────────────────────────
  private async runDriftWatchdog(): Promise<void> {
    this.lastDriftRun = new Date().toISOString();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const start = Date.now();
    try {
      await fetch(`http://127.0.0.1:${process.env.PORT || 7001}/health`, {
        signal: ac.signal,
      });
      clearTimeout(timer);
      this.driftLatencyMs = Date.now() - start;

      if (this.driftBaseline === null) {
        this.driftBaseline = this.driftLatencyMs;
      }

      const isSpike =
        this.driftLatencyMs > 5000 ||
        this.driftLatencyMs > this.driftBaseline * 3;

      if (isSpike && !liteMode.isActive()) {
        liteMode.activate(
          `Latency spike: ${this.driftLatencyMs}ms (baseline ${this.driftBaseline}ms)`,
        );
        this.consecutiveRecoveries = 0;
      } else if (
        !isSpike &&
        this.driftLatencyMs < 2000 &&
        liteMode.isActive()
      ) {
        this.consecutiveRecoveries++;
        if (this.consecutiveRecoveries >= 3) {
          liteMode.deactivate();
          this.consecutiveRecoveries = 0;
          this.driftBaseline = this.driftLatencyMs;
        }
      } else {
        // Update rolling baseline (EMA)
        this.driftBaseline = Math.round(
          this.driftBaseline * 0.8 + this.driftLatencyMs * 0.2,
        );
        this.consecutiveRecoveries = 0;
      }
    } catch {
      clearTimeout(timer);
      this.driftLatencyMs = Date.now() - start;
      // A failed health check already noted by process watchdog
    }
  }

  start(): void {
    console.info(
      "[WatchdogService] Starting — process(10s), health(15s), drift(30s)",
    );
    // Stagger starts to avoid thundering herd on boot
    this.processTimers.push(
      setInterval(() => this.runProcessWatchdog().catch(console.error), 10_000),
    );
    this.processTimers.push(
      setInterval(() => this.runHealthWatchdog().catch(console.error), 15_000),
    );
    this.processTimers.push(
      setInterval(() => this.runDriftWatchdog().catch(console.error), 30_000),
    );
    // Run once immediately after a short delay
    setTimeout(() => this.runHealthWatchdog().catch(console.error), 5_000);
    setTimeout(() => this.runDriftWatchdog().catch(console.error), 10_000);
  }

  stop(): void {
    this.processTimers.forEach(clearInterval);
    this.processTimers = [];
  }

  report(): WatchdogReport {
    const services = Array.from(this.healthState.values());
    return {
      process: { lastRun: this.lastProcessRun, services },
      health: { lastRun: this.lastHealthRun, services },
      drift: {
        lastRun: this.lastDriftRun,
        latencyMs: this.driftLatencyMs,
        liteModeActive: liteMode.isActive(),
        consecutiveRecoveries: this.consecutiveRecoveries,
      },
    };
  }
}

export const watchdogService = new WatchdogService();
