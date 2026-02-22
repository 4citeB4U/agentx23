/**
 * Tier 0 Preflight Test Runner
 * Runs synchronous checks before any build, patch, or deploy
 * LEEWAY-CORE-2026
 *
 * Checks:
 *  1. TypeScript (backend) — tsc --noEmit
 *  2. Core integrity        — integrityVerifier
 *  3. npm audit             — severity: critical only
 *  4. Snapshot exists       — at least one golden snapshot
 *  5. Public key present    — golden/public.pem
 */

import { execSync } from 'child_process';
import fs           from 'fs';
import path         from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const PASS = '  ✅  PASS';
const FAIL = '  ❌  FAIL';
const WARN = '  ⚠   WARN';

type CheckResult = { name: string; passed: boolean; warning?: boolean; output: string };

const results: CheckResult[] = [];

function check(name: string, fn: () => string): void {
  process.stdout.write(`  [ ] ${name}…`);
  try {
    const output = fn();
    results.push({ name, passed: true, output });
    process.stdout.write(`\r${PASS} ${name}\n`);
  } catch (e: any) {
    const output = e.stdout?.toString() || e.message || 'unknown error';
    results.push({ name, passed: false, output });
    process.stdout.write(`\r${FAIL} ${name}\n`);
    if (output.length > 0) console.log(`       ${output.substring(0, 200)}`);
  }
}

function warn(name: string, fn: () => string): void {
  try {
    const output = fn();
    results.push({ name, passed: true, output });
    console.log(`${PASS} ${name}`);
  } catch (e: any) {
    const output = e.message || 'unknown warning';
    results.push({ name, passed: true, warning: true, output });
    console.log(`${WARN} ${name}: ${output.substring(0, 100)}`);
  }
}

// ── 1. TypeScript ─────────────────────────────────────────────────────────
check('TypeScript (backend)', () => {
  execSync('npx tsc --noEmit', { cwd: path.join(ROOT, 'backend'), timeout: 30_000, stdio: 'pipe' });
  return 'types OK';
});

// ── 2. Core integrity ─────────────────────────────────────────────────────
check('Core integrity', () => {
  const manifestPath = path.join(ROOT, 'golden', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('No manifest found. Run: tsx core/integrityVerifier.ts generate');
  }
  execSync(`node --input-type=module -e "
    import { verifyIntegrity } from './core/integrityVerifier.js';
    const r = verifyIntegrity();
    if (!r.valid) { process.stderr.write(JSON.stringify(r)); process.exit(1); }
  "`, { cwd: ROOT, timeout: 15_000, stdio: 'pipe' });
  return 'integrity verified';
});

// ── 3. Public key present ─────────────────────────────────────────────────
check('Sovereign public key', () => {
  const keyPath = path.join(ROOT, 'golden', 'public.pem');
  if (!fs.existsSync(keyPath)) throw new Error('golden/public.pem not found');
  return 'key present';
});

// ── 4. Snapshot exists ────────────────────────────────────────────────────
warn('Golden snapshot exists', () => {
  const dir = path.join(ROOT, 'snapshots');
  if (!fs.existsSync(dir)) throw new Error('snapshots/ directory missing');
  const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('quarantine'));
  if (!snaps.length) throw new Error('No snapshots. Run: tsx core/snapshotManager.ts create boot');
  return `${snaps.length} snapshots found`;
});

// ── 5. npm audit (critical only) ──────────────────────────────────────────
warn('npm audit (critical)', () => {
  const out = execSync('npm audit --audit-level=critical --json', {
    cwd: ROOT, timeout: 30_000, stdio: 'pipe',
  }).toString();
  const report = JSON.parse(out);
  const criticals = report?.metadata?.vulnerabilities?.critical ?? 0;
  if (criticals > 0) throw new Error(`${criticals} critical vulnerability/ies`);
  return 'no criticals';
});

// ── Report ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
const hardFailed = results.filter(r => !r.passed && !r.warning);
const passed     = results.filter(r => r.passed).length;
console.log(`  Preflight: ${passed}/${results.length} checks passed`);
if (hardFailed.length > 0) {
  console.error(`  ${hardFailed.length} hard failure(s) — build blocked.`);
  process.exit(1);
} else {
  console.log('  ✅  All preflight checks passed. Proceed with build.');
  process.exit(0);
}
