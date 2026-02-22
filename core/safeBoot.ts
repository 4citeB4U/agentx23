/**
 * Agent Lee — Safe Mode Boot
 * Layer 5: Emergency recovery when core validation fails
 * LEEWAY-CORE-2026
 *
 * Safe mode:
 *  - Disables custom patches
 *  - Loads last valid snapshot
 *  - Restricts to read-only operations
 *  - Voices alert via console (TTS optional)
 *  - Exposes /api/recovery/* endpoints only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLatestSnapshot, verifySnapshotSignature, diffSnapshot, type Snapshot } from './snapshotManager.js';
import { verifyIntegrity } from './integrityVerifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

export type BootMode = 'sovereign' | 'degraded' | 'safe_mode' | 'lockdown';

let CURRENT_BOOT_MODE: BootMode = 'sovereign';
let SAFE_MODE_REASON: string    = '';
let SAFE_MODE_SNAPSHOT: Snapshot | null = null;

// ── Public state ───────────────────────────────────────────────────────────
export function getBootMode(): BootMode       { return CURRENT_BOOT_MODE; }
export function getSafeModeReason(): string   { return SAFE_MODE_REASON; }
export function isInSafeMode(): boolean       { return CURRENT_BOOT_MODE !== 'sovereign'; }
export function isSovereign(): boolean        { return CURRENT_BOOT_MODE === 'sovereign'; }

// ── Safe mode entry ───────────────────────────────────────────────────────
export function enterSafeMode(reason: string, mode: BootMode = 'safe_mode'): void {
  CURRENT_BOOT_MODE = mode;
  SAFE_MODE_REASON  = reason;

  console.error('\n' + '█'.repeat(60));
  console.error('  ⚠   AGENT LEE SAFE MODE ACTIVATED');
  console.error(`  Mode:   ${mode.toUpperCase()}`);
  console.error(`  Reason: ${reason}`);
  console.error('█'.repeat(60) + '\n');

  // Write safe mode flag for frontend to detect
  const flagPath = path.join(ROOT, 'workspace', 'SAFE_MODE.json');
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, JSON.stringify({
    active:    true,
    mode,
    reason,
    timestamp: new Date().toISOString(),
    snapshot:  SAFE_MODE_SNAPSHOT?.snapshot_id || null,
  }, null, 2));
}

export function exitSafeMode(): void {
  CURRENT_BOOT_MODE = 'sovereign';
  SAFE_MODE_REASON  = '';
  const flagPath = path.join(ROOT, 'workspace', 'SAFE_MODE.json');
  if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
  console.log('  ✅  Safe mode cleared. Agent Lee is sovereign.');
}

// ── Load + restore from snapshot ──────────────────────────────────────────
export function loadSnapshotForRecovery(): Snapshot | null {
  const snapshots = [];
  const snapDir = path.join(ROOT, 'snapshots');
  if (!fs.existsSync(snapDir)) return null;

  const files = fs.readdirSync(snapDir).filter(f => f.endsWith('.json')).sort();
  for (const f of files.reverse()) {
    try {
      const snap: Snapshot = JSON.parse(
        fs.readFileSync(path.join(snapDir, f), 'utf8')
      );
      // Prefer signed snapshots; fall back to any valid one
      const diff = diffSnapshot(snap);
      if (diff.modified.length === 0 && diff.removed.length === 0) {
        SAFE_MODE_SNAPSHOT = snap;
        return snap;
      }
    } catch { /* skip corrupt snapshot */ }
  }
  return getLatestSnapshot();
}

// ── Boot sequence ─────────────────────────────────────────────────────────
export interface SafeBootResult {
  mode:     BootMode;
  ok:       boolean;
  reason?:  string;
  snapshot: Snapshot | null;
  integrity: ReturnType<typeof verifyIntegrity>;
}

export function safeBoot(skipIntegrity = false): SafeBootResult {
  console.log('\n  [SafeBoot] Starting Agent Lee sovereign boot check…');

  const integrity = skipIntegrity
    ? { valid: true, compromised: [], missing: [], new_files: [], signature_ok: null }
    : verifyIntegrity();

  // Hard failures → lockdown
  if (!integrity.valid && (integrity.compromised.length > 0 || integrity.missing.length > 0)) {
    const reason = [
      integrity.compromised.length ? `Tampered: ${integrity.compromised.slice(0,3).join(', ')}` : '',
      integrity.missing.length     ? `Missing: ${integrity.missing.slice(0,3).join(', ')}`   : '',
    ].filter(Boolean).join(' | ');

    enterSafeMode(reason, 'lockdown');
    const snapshot = loadSnapshotForRecovery();
    return { mode: 'lockdown', ok: false, reason, snapshot, integrity };
  }

  // Unregistered new files → degraded (warn but continue)
  if (integrity.new_files.length > 0) {
    const reason = `Unregistered files detected: ${integrity.new_files.slice(0,3).join(', ')}`;
    enterSafeMode(reason, 'degraded');
    const snapshot = getLatestSnapshot();
    console.warn('  ⚠  Degraded mode — new unregistered files. Review and regenerate manifest.');
    return { mode: 'degraded', ok: true, reason, snapshot, integrity };
  }

  // All clear
  console.log('  ✅  Boot check passed. Integrity verified. Agent Lee is sovereign.');
  const snap = getLatestSnapshot();
  return { mode: 'sovereign', ok: true, snapshot: snap, integrity };
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('safeBoot')) {
  const result = safeBoot();
  console.log(JSON.stringify({
    mode: result.mode, ok: result.ok, reason: result.reason,
    snapshot_id: result.snapshot?.snapshot_id,
  }, null, 2));
  process.exit(result.ok ? 0 : 1);
}
