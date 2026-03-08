// LEEWAY v12 HEADER
// File: backend/src/services/CerebralOperator.ts
// Purpose: Governed HTTP client for Cerebral Control Plane.
// All calls attach x-neural-handshake and x-correlation-id.
// Retry with exponential backoff. Never throws — returns typed failure results.
// HARD RULE: Frontend must NEVER call Cerebral directly. All calls go through this operator.

import { v4 as uuidv4 } from "uuid";

// ── Config ────────────────────────────────────────────────────────────────
const CEREBRAL_BASE = (
  process.env.CEREBRAL_BASE_URL || "http://localhost:8200"
).replace(/\/$/, "");
const CEREBRAL_HANDSHAKE_REQUIRED =
  (process.env.CEREBRAL_HANDSHAKE_REQUIRED || "true") === "true";
const CEREBRAL_TIMEOUT_MS = Number(process.env.CEREBRAL_TIMEOUT_MS || 15000);
const CEREBRAL_MAX_RETRIES = Number(process.env.CEREBRAL_MAX_RETRIES || 2);
const AGENT_HANDSHAKE =
  process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";

// ── Types ─────────────────────────────────────────────────────────────────
export interface CerebralRequest {
  action: string; // required — e.g. "desktop_action", "get_system_health"
  payload?: Record<string, unknown>;
  confirm?: boolean;
}

export interface CerebralResponse {
  ok: true;
  correlation_id: string;
  data: unknown;
  latencyMs: number;
}

export interface CerebralFailure {
  ok: false;
  correlation_id: string;
  error: string;
  code:
    | "CEREBRAL_UNAVAILABLE"
    | "CEREBRAL_TIMEOUT"
    | "CEREBRAL_ERROR"
    | "CEREBRAL_GOVERNANCE_BLOCK";
  degraded: true;
}

export interface CerebralAlert {
  correlation_id: string;
  device_signature?: string;
  timestamp: string;
  severity: "info" | "warn" | "error" | "critical";
  summary: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

type CerebralResult = CerebralResponse | CerebralFailure;

// ── HTTP helper with retry ────────────────────────────────────────────────
async function cerebraFetch(
  path: string,
  opts: RequestInit,
  correlationId: string,
): Promise<CerebralResult> {
  const url = `${CEREBRAL_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-correlation-id": correlationId,
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (CEREBRAL_HANDSHAKE_REQUIRED) {
    headers["x-neural-handshake"] = AGENT_HANDSHAKE;
  }

  let lastError = "";
  for (let attempt = 0; attempt <= CEREBRAL_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), CEREBRAL_TIMEOUT_MS);
    const start = Date.now();
    try {
      const res = await fetch(url, { ...opts, headers, signal: ac.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      return { ok: true, correlation_id: correlationId, data, latencyMs };
    } catch (e) {
      clearTimeout(timer);
      const isTimeout = (e as Error).name === "AbortError";
      lastError = isTimeout ? "TIMEOUT" : (e as Error).message;
      if (isTimeout) {
        return {
          ok: false,
          correlation_id: correlationId,
          error: `Cerebral request timed out after ${CEREBRAL_TIMEOUT_MS}ms`,
          code: "CEREBRAL_TIMEOUT",
          degraded: true,
        };
      }
    }
  }

  return {
    ok: false,
    correlation_id: correlationId,
    error: `Cerebral unavailable after ${CEREBRAL_MAX_RETRIES + 1} attempts: ${lastError}`,
    code: "CEREBRAL_UNAVAILABLE",
    degraded: true,
  };
}

// ── Public API ────────────────────────────────────────────────────────────
export const CerebralOperator = {
  /** Public-safe health probe — no auth required outbound */
  async health(): Promise<CerebralResult> {
    const corrId = uuidv4();
    return cerebraFetch("/health", { method: "GET", headers: {} }, corrId);
  },

  /** Gated — returns Cerebral system status */
  async status(handshake: string): Promise<CerebralResult> {
    const corrId = uuidv4();
    if (CEREBRAL_HANDSHAKE_REQUIRED && handshake !== AGENT_HANDSHAKE) {
      return {
        ok: false,
        correlation_id: corrId,
        error: "INVALID_HANDSHAKE",
        code: "CEREBRAL_GOVERNANCE_BLOCK",
        degraded: true,
      };
    }
    return cerebraFetch("/api/status", { method: "GET" }, corrId);
  },

  /** Gated — execute a governed Cerebral action */
  async request(
    req: CerebralRequest,
    handshake: string,
  ): Promise<CerebralResult> {
    const corrId = uuidv4();
    if (!req.action) {
      return {
        ok: false,
        correlation_id: corrId,
        error: "MISSING_ACTION_FIELD",
        code: "CEREBRAL_GOVERNANCE_BLOCK",
        degraded: true,
      };
    }
    if (CEREBRAL_HANDSHAKE_REQUIRED && handshake !== AGENT_HANDSHAKE) {
      return {
        ok: false,
        correlation_id: corrId,
        error: "INVALID_HANDSHAKE",
        code: "CEREBRAL_GOVERNANCE_BLOCK",
        degraded: true,
      };
    }
    return cerebraFetch(
      "/api/action",
      { method: "POST", body: JSON.stringify(req) },
      corrId,
    );
  },

  /** Ingest an inbound alert from Cerebral (signature already verified by route) */
  async ingestAlert(alert: CerebralAlert): Promise<void> {
    console.info(
      `[CerebralAlert] ${alert.severity.toUpperCase()} — ${alert.summary} [${alert.correlation_id}]`,
    );
    // Persisted and relayed by the alert route handler
  },
};
