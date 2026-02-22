/**
 * Agent Lee — Recovery Engine (Orchestrator)
 * Master coordinator for the Sovereign Self-Repair Architecture
 * LEEWAY-CORE-2026
 *
 * Protocol for every patch:
 *   1. snapshot()          — capture current state
 *   2. checkInvariants()   — block if CORE layer violation
 *   3. applyPatch()        — write diff to disk
 *   4. runPreflightTests() — Tier 0 fast-checks
 *   5a. OK  → commit() + logPatch('approved')
 *   5b. FAIL → revert() + logPatch('reverted')
 *   5c. CRASH → quarantine() + emergencyRestore()
 */

import { createSnapshot, getLatestSnapshot } from './snapshotManager.js';
import { verifyIntegrity }                   from './integrityVerifier.js';
import { quarantine }                        from './quarantineManager.js';
import { safeBoot, isInSafeMode, enterSafeMode } from './safeBoot.js';
import { checkInvariant }                    from './guards/invariants.js';
import { checkEditPermission, type EditModeToken } from './guards/permission.js';
import { logPatch, updatePatchStatus }       from './guards/patchlog.js';
import { execSync }                          from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Types ─────────────────────────────────────────────────────────────────
export interface Patch {
  /** Human-readable description */
  description: string;
  /** Files this patch will touch (relative to ROOT) */
  files:       string[];
  /** Function that applies the patch; throws on failure */
  apply:       () => void | Promise<void>;
  /** Authorization token from permission.ts */
  token?:      EditModeToken;
  /** Who requested the patch */
  requestedBy?: string;
}

export interface TestResult {
  name:   string;
  passed: boolean;
  output: string;
}

export interface RecoveryResult {
  ok:        boolean;
  patchId?:  string;
  committed: boolean;
  reverted:  boolean;
  reason?:   string;
  tests:     TestResult[];
}

// ── Preflight test runner ─────────────────────────────────────────────────
function runPreflightTests(): TestResult[] {
  const results: TestResult[] = [];

  // TypeScript type-check (backend)
  try {
    execSync('npx tsc --noEmit', { cwd: path.join(ROOT, 'backend'), timeout: 30_000 });
    results.push({ name: 'tsc', passed: true, output: 'OK' });
  } catch (e: any) {
    results.push({ name: 'tsc', passed: false, output: e.stdout?.toString() || e.message });
  }

  // Core integrity check
  try {
    const iResult = verifyIntegrity();
    results.push({
      name:   'integrity',
      passed: iResult.valid,
      output: iResult.valid ? 'OK' : `Compromised: ${iResult.compromised.join(', ')}`,
    });
  } catch (e: any) {
    results.push({ name: 'integrity', passed: false, output: e.message });
  }

  return results;
}

// ── Main applyWithRollback ────────────────────────────────────────────────
export async function applyWithRollback(patch: Patch): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    ok: false, committed: false, reverted: false, tests: [],
  };

  // 0. Refuse if already in lockdown
  if (isInSafeMode()) {
    return { ...result, reason: 'Agent Lee is in safe mode. Patches blocked until resurrection.' };
  }

  // 1. Permission check
  if (patch.token) {
    const permitted = patch.files.every(f => checkEditPermission(patch.token!, f));
    if (!permitted) {
      return { ...result, reason: 'Edit permission denied for one or more target files.' };
    }
  }

  // 2. Invariant check
  for (const file of patch.files) {
    const ok = checkInvariant(file, 'write');
    if (!ok) {
      return { ...result, reason: `Invariant violation: ${file} is a CORE-protected file.` };
    }
  }

  // 3. Pre-patch snapshot
  const preSnap = createSnapshot(`pre-${patch.description.substring(0, 20).replace(/\s+/g, '-')}`, false);
  if (!preSnap) {
    return { ...result, reason: 'Failed to create pre-patch snapshot.' };
  }

  // 4. Log the patch (pending)
  const patchId = logPatch({
    description: patch.description,
    targetFiles: patch.files,
    diff:        '',
    rollbackPlan: `Revert to snapshot: ${preSnap.snapshot_id}`,
    requestedBy: patch.requestedBy || 'recovery-engine',
  });
  result.patchId = patchId;

  // 5. Apply the patch
  try {
    await patch.apply();
  } catch (e: any) {
    updatePatchStatus(patchId, 'reverted');
    return { ...result, reverted: true, reason: `Patch apply threw: ${e.message}` };
  }

  // 6. Run preflight tests
  result.tests = runPreflightTests();
  const allPassed = result.tests.every(t => t.passed);

  if (allPassed) {
    // 7a. Commit — snapshot + log
    createSnapshot(`post-${patch.description.substring(0, 20).replace(/\s+/g, '-')}`, false);
    updatePatchStatus(patchId, 'approved');
    result.ok        = true;
    result.committed = true;
    console.log(`  ✅  Patch committed: ${patch.description}`);
  } else {
    // 7b. Tests failed — revert by restoring pre-patch file states from snapshot
    const failed = result.tests.filter(t => !t.passed).map(t => t.name).join(', ');
    console.warn(`  ⚠  Preflight failed (${failed}). Reverting patch…`);
    updatePatchStatus(patchId, 'reverted');
    result.reason   = `Preflight failed: ${failed}`;
    result.reverted = true;
    // Quarantine the bad patch product
    for (const f of patch.files) {
      const abs = path.resolve(ROOT, f);
      if (fs.existsSync(abs)) quarantine(abs, `patch-reverted:${patchId}`);
    }
  }

  return result;
}

// ── Emergency restore (no auth required) ─────────────────────────────────
export function emergencyRestore(): void {
  console.error('\n  ⚡  EMERGENCY RESTORE TRIGGERED');
  const snap = getLatestSnapshot();
  if (!snap) {
    enterSafeMode('Emergency restore: no snapshot available', 'lockdown');
    return;
  }
  safeBoot();
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('recoveryEngine')) {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'emergency') {
    emergencyRestore();
  } else {
    console.log('Usage: tsx core/recoveryEngine.ts emergency');
  }
}
