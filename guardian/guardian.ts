/**
 * AGENT LEE — GUARDIAN CORE
 * Local Sovereign Policy Engine | LEEWAY-CORE-2026
 * 
 * Sits between Agent Lee and the OS.
 * Every action must be authorized before execution.
 * 
 * Architecture: Agent → Guardian → OS
 */

import { createHash } from 'crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load policy
const POLICY_PATH = join(__dirname, 'policy.json');
const POLICY = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));

// Audit log paths
const AUDIT_DIR = process.env.GUARDIAN_AUDIT_DIR || 'C:/Guardian/audit';
const AUDIT_LOG = join(AUDIT_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
const HASH_LEDGER = join(AUDIT_DIR, 'hash-ledger', 'ledger.log');

// Machine ID (persistent fingerprint)
let MACHINE_ID = process.env.MACHINE_ID || 'UNKNOWN';

// Ensure audit dirs exist
function ensureAuditDirs() {
  [AUDIT_DIR, join(AUDIT_DIR, 'hash-ledger')].forEach(dir => {
    if (!existsSync(dir)) {
      try { mkdirSync(dir, { recursive: true }); } catch {}
    }
  });
}

// Immutable audit write — append-only, never overwrite
function writeAudit(entry: Record<string, unknown>) {
  ensureAuditDirs();
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    machineId: MACHINE_ID,
    ...entry
  });
  const hash = createHash('sha256').update(record).digest('hex');

  try {
    appendFileSync(AUDIT_LOG, record + '\n', 'utf8');
    appendFileSync(HASH_LEDGER, `${hash} | ${entry.actionType} | ${entry.timestamp}\n`, 'utf8');
  } catch (e) {
    // Fallback: write to local directory if C:/Guardian doesn't exist
    const fallbackLog = join(__dirname, `guardian-audit-${new Date().toISOString().slice(0, 10)}.log`);
    appendFileSync(fallbackLog, record + '\n', 'utf8');
  }
}

// Risk levels
const RISK_ORDER: Record<string, number> = {
  low: 0, medium: 1, high: 2, critical: 3
};

// Core authorization engine
export function authorize(
  actionType: string,
  payload: Record<string, unknown> = {},
  opts: { creatorSignature?: string; skipConfirmation?: boolean } = {}
): { allowed: boolean; reason?: string } {

  const rule = POLICY[actionType];

  // Unknown action = blocked by default
  if (!rule) {
    const reason = `Action type "${actionType}" is not in policy — blocked by default.`;
    writeAudit({ actionType, payload: sanitizePayload(payload), status: 'DENIED', reason });
    return { allowed: false, reason };
  }

  // Signature required?
  if (rule.requiresCreatorSignature && !opts.creatorSignature) {
    const reason = `${actionType} requires a creator signature. Provide X-Creator-Signature.`;
    writeAudit({ actionType, payload: sanitizePayload(payload), status: 'DENIED', reason });
    return { allowed: false, reason };
  }

  // Check allowed executables for process.launch
  if (actionType === 'process.launch' && payload.executable) {
    const allowed = rule.allowedExecutables?.some(
      (e: string) => String(payload.executable).toLowerCase().includes(e.toLowerCase())
    );
    if (!allowed) {
      const reason = `Executable "${payload.executable}" is not in the allowlist.`;
      writeAudit({ actionType, payload: sanitizePayload(payload), status: 'DENIED', reason });
      return { allowed: false, reason };
    }
  }

  // Check allowed hosts for network.external
  if (actionType === 'network.external' && payload.host) {
    const allowed = rule.allowedHosts?.some(
      (h: string) => String(payload.host).includes(h)
    );
    if (!allowed) {
      const reason = `Host "${payload.host}" is not in the network allowlist.`;
      writeAudit({ actionType, payload: sanitizePayload(payload), status: 'DENIED', reason });
      return { allowed: false, reason };
    }
  }

  // Check blocked paths for file operations
  if ((actionType === 'file.write' || actionType === 'file.delete') && payload.path) {
    const blocked = rule.blockedPaths?.some(
      (p: string) => String(payload.path).toLowerCase().startsWith(p.toLowerCase())
    );
    if (blocked) {
      const reason = `Path "${payload.path}" is in the blocked paths list.`;
      writeAudit({ actionType, payload: sanitizePayload(payload), status: 'DENIED', reason });
      return { allowed: false, reason };
    }
  }

  // All checks passed — approved
  writeAudit({
    actionType,
    payload: sanitizePayload(payload),
    status: 'APPROVED',
    risk: rule.risk,
    signatureVerified: Boolean(opts.creatorSignature)
  });

  return { allowed: true };
}

// Strip secrets from payload before logging
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...payload };
  const secretKeys = ['password', 'key', 'secret', 'token', 'signature', 'apiKey', 'api_key'];
  for (const k of secretKeys) {
    if (safe[k]) safe[k] = '[REDACTED]';
  }
  if (safe.code) safe.code = `[CODE:${createHash('sha256').update(String(safe.code)).digest('hex').slice(0, 16)}]`;
  return safe;
}

// Get current policy for an action
export function getPolicy(actionType: string) {
  return POLICY[actionType] || null;
}

// List all policy rules (for inspection)
export function listPolicies(): string[] {
  return Object.keys(POLICY).filter(k => !k.startsWith('_'));
}

export default { authorize, getPolicy, listPolicies };
