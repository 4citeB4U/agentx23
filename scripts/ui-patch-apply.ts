/**
 * UI Patch Apply Script
 * Applies a JSON-described surface-layer UI patch with full rollback protection
 * LEEWAY-CORE-2026
 *
 * Usage:
 *   tsx scripts/ui-patch-apply.ts <patch-file.json>
 *
 * Patch JSON format:
 * {
 *   "description": "Move help button to top bar",
 *   "files": {
 *     "src/App.tsx": "...full new content...",
 *     "style.css":   "...full new content..."
 *   },
 *   "requestedBy": "agent-lee"
 * }
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { grantEditMode, revokeEditMode } from '../core/guards/permission.js';
import { applyWithRollback } from '../core/recoveryEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

interface UIPatch {
  description: string;
  files:       Record<string, string>;
  requestedBy?: string;
}

async function main() {
  const patchFilePath = process.argv[2];
  if (!patchFilePath) {
    console.error('Usage: tsx scripts/ui-patch-apply.ts <patch-file.json>');
    process.exit(1);
  }

  const absPath = path.resolve(patchFilePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Patch file not found: ${absPath}`);
    process.exit(1);
  }

  let patch: UIPatch;
  try {
    patch = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (e: any) {
    console.error(`Invalid patch JSON: ${e.message}`);
    process.exit(1);
  }

  const files = Object.keys(patch.files);

  // Grant surface-scope edit token
  const token = grantEditMode(5 * 60 * 1000, patch.requestedBy || 'ui-patch-apply', 'surface');

  const result = await applyWithRollback({
    description:  patch.description,
    files,
    requestedBy:  patch.requestedBy,
    token,
    apply: async () => {
      for (const [relPath, content] of Object.entries(patch.files)) {
        const abs = path.join(ROOT, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
      }
    },
  });

  revokeEditMode();

  if (result.ok) {
    console.log(`\n  ✅  Patch applied: ${patch.description}`);
    console.log(`  Patch ID: ${result.patchId}`);
    process.exit(0);
  } else {
    console.error(`\n  ❌  Patch FAILED: ${result.reason}`);
    if (result.reverted) console.log('  ↩  Changes reverted.');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
