/**
 * Agent Lee — Signed Resurrection Protocol
 * Layer 6: Creator-only full system restore
 * LEEWAY-CORE-2026
 *
 * Only the creator (holder of private.pem) can authorize resurrection.
 *
 * Flow:
 *   1. Creator signs payload: tsx core/keyManager.ts sign "RESURRECT:<timestamp>"
 *   2. Calls POST /api/recovery/resurrect { payload, signature }
 *   3. Backend calls resurrection(payload, signature) here
 *   4. Verifies RSA-4096 signature
 *   5. Runs safeBoot from last golden snapshot
 *   6. Clears safe mode
 *   7. Logs resurrection event
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifySignature, hasKeypair } from './keyManager.js';
import { safeBoot, exitSafeMode } from './safeBoot.js';
import { createSnapshot } from './snapshotManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const RESURRECTION_LOG = path.join(ROOT, 'workspace', 'resurrection.log.json');

// ── Log helpers ───────────────────────────────────────────────────────────
function logResurrection(payload: string, success: boolean, reason?: string): void {
  const log: any[] = fs.existsSync(RESURRECTION_LOG)
    ? JSON.parse(fs.readFileSync(RESURRECTION_LOG, 'utf8'))
    : [];
  log.push({
    id:        crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    payload_prefix: payload.substring(0, 32),
    success,
    reason,
  });
  fs.mkdirSync(path.dirname(RESURRECTION_LOG), { recursive: true });
  fs.writeFileSync(RESURRECTION_LOG, JSON.stringify(log, null, 2));
}

// ── Payload format validation  ─────────────────────────────────────────────
// Expected: "RESURRECT:<ISO8601-timestamp>"
// Timestamp must be within ±5 minutes (prevents replay attacks)
function validatePayloadFreshness(payload: string): { ok: boolean; reason?: string } {
  const match = payload.match(/^RESURRECT:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (!match) {
    return { ok: false, reason: 'Payload format invalid. Expected: RESURRECT:<ISO8601>' };
  }
  const ts   = new Date(match[1]).getTime();
  const now  = Date.now();
  const diff = Math.abs(now - ts);
  if (diff > 5 * 60 * 1000) {
    return { ok: false, reason: `Payload too old (${Math.round(diff / 1000)}s). Max window: 300s.` };
  }
  return { ok: true };
}

// ── Main resurrection function ─────────────────────────────────────────────
export interface ResurrectionResult {
  ok:       boolean;
  reason?:  string;
  boot?:    Awaited<ReturnType<typeof safeBoot>>;
}

export function resurrection(payload: string, signature: string): ResurrectionResult {
  console.log('\n  [Resurrection] Resurrection request received.');
  console.log(`  Payload: ${payload.substring(0, 40)}…`);

  // 1. Key must exist
  if (!hasKeypair()) {
    const reason = 'No public key found. Cannot verify resurrection authority.';
    console.error(`  ❌  ${reason}`);
    logResurrection(payload, false, reason);
    return { ok: false, reason };
  }

  // 2. Check payload freshness (anti-replay)
  const freshness = validatePayloadFreshness(payload);
  if (!freshness.ok) {
    console.error(`  ❌  ${freshness.reason}`);
    logResurrection(payload, false, freshness.reason);
    return { ok: false, reason: freshness.reason };
  }

  // 3. Verify RSA-4096 signature
  const sigValid = verifySignature(payload, signature);
  if (!sigValid) {
    const reason = 'Signature verification FAILED. Resurrection DENIED.';
    console.error(`  ❌  ${reason}`);
    logResurrection(payload, false, reason);
    return { ok: false, reason };
  }

  console.log('  ✅  Signature valid. Initiating resurrection…');

  // 4. Pre-resurrection snapshot (capture current state for forensics)
  try {
    createSnapshot('pre-resurrection');
  } catch { /* non-fatal */ }

  // 5. Run safe boot (integrity check + snapshot restore)
  const boot = safeBoot(false);

  // 6. Clear safe mode if boot succeeded
  if (boot.ok) {
    exitSafeMode();
    console.log('  ✅  Resurrection complete. Agent Lee is sovereign.');
  } else {
    console.error('  ⚠  Boot passed signature check but integrity issues remain.');
  }

  logResurrection(payload, boot.ok, boot.reason);
  return { ok: boot.ok, reason: boot.reason, boot };
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('resurrection')) {
  const [payload, signature] = process.argv.slice(2);
  if (!payload || !signature) {
    console.log('Usage: tsx core/resurrection.ts "<RESURRECT:TIMESTAMP>" "<BASE64_SIGNATURE>"');
    console.log('\nTo generate payload + signature:');
    console.log('  payload="RESURRECT:$(date -u +%Y-%m-%dT%H:%M:%S)"');
    console.log('  sig=$(tsx core/keyManager.ts sign "$payload")');
    console.log('  tsx core/resurrection.ts "$payload" "$sig"');
    process.exit(1);
  }
  const result = resurrection(payload, signature);
  process.exit(result.ok ? 0 : 1);
}
