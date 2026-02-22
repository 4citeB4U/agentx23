/**
 * UI Patch Revert Script
 * Reverts a previously applied patch by patch ID
 * LEEWAY-CORE-2026
 *
 * Usage:
 *   tsx scripts/ui-patch-revert.ts <patchId>
 *   tsx scripts/ui-patch-revert.ts --list
 */

import { getPatch, updatePatchStatus, getPatches } from '../core/guards/patchlog.js';
import { quarantine } from '../core/quarantineManager.js';
import { getLatestSnapshot, listSnapshots } from '../core/snapshotManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

async function main() {
  const arg = process.argv[2];

  if (arg === '--list') {
    const patches = getPatches({ status: 'approved' });
    if (!patches.length) {
      console.log('  No approved patches to revert.');
      process.exit(0);
    }
    console.log('\n  Approved patches (revertable):\n');
    for (const p of patches) {
      console.log(`  ${p.timestamp.substring(0, 19)}  [${p.patchId.substring(0, 8)}]  ${p.description}`);
      console.log(`    Files: ${p.targetFiles.join(', ')}`);
      console.log(`    Rollback: ${p.rollbackPlan}\n`);
    }
    process.exit(0);
  }

  if (!arg) {
    console.error('Usage: tsx scripts/ui-patch-revert.ts <patchId>');
    console.error('  Or:  tsx scripts/ui-patch-revert.ts --list');
    process.exit(1);
  }

  const patchId = arg;
  const record  = getPatch(patchId);

  if (!record) {
    console.error(`  Patch not found: ${patchId}`);
    process.exit(1);
  }

  if (record.status === 'reverted') {
    console.log(`  Patch ${patchId} is already reverted.`);
    process.exit(0);
  }

  console.log(`\n  Reverting patch: ${record.description}`);
  console.log(`  Files: ${record.targetFiles.join(', ')}`);
  console.log(`  Rollback plan: ${record.rollbackPlan}\n`);

  // If rollback plan references a snapshot, find it
  const snapIdMatch = record.rollbackPlan.match(/snapshot[_ ]([a-zA-Z0-9_-]+)/i);
  if (snapIdMatch) {
    const allSnaps = listSnapshots();
    const target   = allSnaps.find(s => s.snapshot.snapshot_id.includes(snapIdMatch[1]));
    if (target) {
      console.log(`  Found rollback snapshot: ${target.snapshot.snapshot_id}`);
      // Quarantine current state of affected files for forensics
      for (const f of record.targetFiles) {
        const abs = path.join(ROOT, f);
        try { quarantine(abs, `revert:${patchId}`); } catch { /* file may not exist */ }
      }
    } else {
      console.warn('  ⚠  Snapshot referenced in rollback plan not found. Manual restoration may be needed.');
    }
  }

  updatePatchStatus(patchId, 'reverted');
  console.log(`  ✅  Patch ${patchId} marked as reverted.`);
  console.log(`  Note: File content rollback requires manual restoration from snapshot or git.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
