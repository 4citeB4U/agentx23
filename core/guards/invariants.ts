/**
 * Agent Lee — Invariants Guard
 * Defines what is CORE (immutable) versus SURFACE (patchable)
 * LEEWAY-CORE-2026
 *
 * Any attempt to write to a CORE file without explicit resurrection
 * authority is blocked at the RecoveryEngine layer.
 */

// ── CORE files: must never be mutated by patch system ─────────────────────
// These protect Agent Lee's identity, security, and sovereign operations.
export const CORE_FILES: string[] = [
  // Self-repair architecture
  'core/keyManager.ts',
  'core/snapshotManager.ts',
  'core/integrityVerifier.ts',
  'core/quarantineManager.ts',
  'core/safeBoot.ts',
  'core/resurrection.ts',
  'core/recoveryEngine.ts',
  'core/guards/invariants.ts',
  'core/guards/permission.ts',
  'core/guards/patchlog.ts',

  // Golden credentials
  'golden/public.pem',
  'golden/manifest.json',

  // Backend security layer
  'backend/src/services/security.ts',
  'backend/src/services/terminal-policy.ts',
  'backend/src/services/terminal-audit.ts',
  'backend/src/index.ts',

  // Identity & persona
  'agentLee.persona.json',
  'AGENT_LEE_BIBLE.md',
  'SOVEREIGN_HANDSHAKE.md',
];

// ── SURFACE files: safe to patch with valid EditModeToken ──────────────────
// Agent Lee may self-modify these for UI improvements, layout changes, etc.
export const SURFACE_FILES: string[] = [
  // UI
  'src/App.tsx',
  'src/components/',
  'style.css',
  'PACMAN.html',

  // Cosmetic content
  'src/assets/',
  'src/styles/',
  'src/themes/',

  // Game / demo
  'game.js',
];

// ── Layer classification ──────────────────────────────────────────────────
export type FileLayer = 'core' | 'surface' | 'unknown';

export function classifyFile(relPath: string): FileLayer {
  const normalized = relPath.replace(/\\/g, '/');

  for (const pattern of CORE_FILES) {
    if (normalized === pattern || normalized.startsWith(pattern)) {
      return 'core';
    }
  }
  for (const pattern of SURFACE_FILES) {
    if (normalized === pattern || normalized.startsWith(pattern)) {
      return 'surface';
    }
  }
  return 'unknown';
}

// ── Invariant rule engine ─────────────────────────────────────────────────
export type Operation = 'read' | 'write' | 'delete' | 'rename';

export interface InvariantViolation {
  file:      string;
  operation: Operation;
  rule:      string;
}

export function checkInvariant(relPath: string, op: Operation): boolean {
  const layer = classifyFile(relPath);

  // Rule 1: CORE files are immutable (write/delete/rename blocked)
  if (layer === 'core' && (op === 'write' || op === 'delete' || op === 'rename')) {
    return false;
  }

  // Rule 2: Golden directory is always read-only
  if (relPath.startsWith('golden/') && op !== 'read') {
    return false;
  }

  // Rule 3: Snapshot directory is append-only (delete blocked)
  if (relPath.startsWith('snapshots/') && op === 'delete') {
    return false;
  }

  // Rule 4: Quarantine is forensic-only (no writes allowed by patch system)
  if (relPath.startsWith('quarantine/') && op === 'write') {
    return false;
  }

  return true;
}

// Report all violations for a proposed patch
export function auditPatch(files: string[], op: Operation): InvariantViolation[] {
  return files
    .filter(f => !checkInvariant(f, op))
    .map(f => ({
      file: f,
      operation: op,
      rule: classifyFile(f) === 'core'
        ? 'CORE_IMMUTABLE'
        : f.startsWith('golden/') ? 'GOLDEN_READ_ONLY'
        : f.startsWith('snapshots/') ? 'SNAPSHOT_APPEND_ONLY'
        : 'QUARANTINE_FORENSIC_ONLY',
    }));
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('invariants')) {
  const [file, op] = process.argv.slice(2) as [string, Operation];
  if (!file || !op) {
    console.log('Usage: tsx core/guards/invariants.ts <file> <read|write|delete|rename>');
    console.log('\nCORE files:');
    CORE_FILES.forEach(f => console.log(`  ${f}`));
    console.log('\nSURFACE files:');
    SURFACE_FILES.forEach(f => console.log(`  ${f}`));
    process.exit(0);
  }
  const ok = checkInvariant(file, op);
  console.log(`${ok ? '✅ ALLOWED' : '❌ BLOCKED'}: ${op.toUpperCase()} on ${file}`);
  process.exit(ok ? 0 : 1);
}
