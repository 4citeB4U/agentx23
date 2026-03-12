// LEEWAY v12 HEADER
// File: backend/src/routes/cerebral.ts
// Purpose: Governed bridge routes for Cerebral Control Plane.
// All state-mutating routes require x-neural-handshake.
// Inbound Cerebral alerts require HMAC-SHA256 signature.

import crypto from "crypto";
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    CerebralAlert,
    CerebralOperator,
} from "../services/CerebralOperator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGENT_HANDSHAKE =
  process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";
const CEREBRAL_WEBHOOK_SECRET = process.env.CEREBRAL_WEBHOOK_SECRET || "";
const ALERTS_LOG = path.resolve(
  __dirname,
  "../../../workspace/cerebral_alerts.jsonl",
);

// Ensure alerts log dir exists
fs.mkdirSync(path.dirname(ALERTS_LOG), { recursive: true });

function verifyHandshake(req: import("express").Request): boolean {
  const h = req.headers["x-neural-handshake"];
  return typeof h === "string" && h === AGENT_HANDSHAKE;
}

function verifyCerebralSignature(
  req: import("express").Request,
  rawBody: string,
): boolean {
  if (!CEREBRAL_WEBHOOK_SECRET) return true; // Bypass if no secret configured
  const sig = req.headers["x-cerebral-signature"];
  if (typeof sig !== "string") return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", CEREBRAL_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function appendAlertLog(alert: CerebralAlert): void {
  try {
    fs.appendFileSync(ALERTS_LOG, JSON.stringify(alert) + "\n");
  } catch {
    // Non-fatal
  }
}

export const cerebralRouter = Router();

// ── GET /api/cerebral/health ─────────────────────────────────────────────
// Public-safe. Probes Cerebral and returns its health without exposing internals.
cerebralRouter.get("/health", async (_req, res) => {
  const result = await CerebralOperator.health();
  res.json(result);
});

// ── GET /api/cerebral/status ─────────────────────────────────────────────
// Handshake-gated. Returns full Cerebral system status.
cerebralRouter.get("/status", async (req, res) => {
  if (!verifyHandshake(req)) {
    return res.status(401).json({ error: "INVALID_HANDSHAKE" });
  }
  const handshake = req.headers["x-neural-handshake"] as string;
  const result = await CerebralOperator.status(handshake);
  res.json(result);
});

// ── POST /api/cerebral/request ────────────────────────────────────────────
// Handshake-gated. Execute a governed Cerebral action.
// Body schema: { action: string, payload?: object, confirm?: boolean }
cerebralRouter.post("/request", async (req, res) => {
  if (!verifyHandshake(req)) {
    return res.status(401).json({ error: "INVALID_HANDSHAKE" });
  }
  const { action, payload, confirm } = req.body || {};
  if (typeof action !== "string" || !action.trim()) {
    return res.status(400).json({ error: "MISSING_ACTION_FIELD" });
  }
  const handshake = req.headers["x-neural-handshake"] as string;
  const result = await CerebralOperator.request(
    { action, payload, confirm },
    handshake,
  );
  res.json(result);
});

// ── POST /api/alerts/cerebral ─────────────────────────────────────────────
// Inbound webhook from Cerebral. Needs HMAC signature verification.
// Stores alert in cerebral_alerts.jsonl and logs to console.
cerebralRouter.post("/alert", async (req, res) => {
  // Raw body for signature verification (express.json already parsed, reconstruct)
  const rawBody = JSON.stringify(req.body);
  if (!verifyCerebralSignature(req, rawBody)) {
    console.warn("[Cerebral] Alert rejected — invalid signature");
    return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  const alert: CerebralAlert = {
    correlation_id:
      (req.headers["x-correlation-id"] as string) || crypto.randomUUID(),
    device_signature:
      (req.headers["x-device-signature"] as string) || undefined,
    timestamp: new Date().toISOString(),
    severity: req.body.severity || "info",
    summary: req.body.summary || "(no summary)",
    source: req.body.source || "cerebral",
    metadata: req.body.metadata || {},
  };

  appendAlertLog(alert);
  await CerebralOperator.ingestAlert(alert);

  res.json({ ok: true, correlation_id: alert.correlation_id });
});
