/**
 * tests/unit/core-guards.test.ts
 * Unit tests for invariants, permission, and patchlog
 * LEEWAY-CORE-2026
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkInvariant, classifyFile, auditPatch } from '../../core/guards/invariants.js';
import { grantEditMode, checkEditPermission, revokeEditMode, getActiveToken } from '../../core/guards/permission.js';
import { logPatch, updatePatchStatus, getPatch, patchStats } from '../../core/guards/patchlog.js';

// ── invariants.ts ─────────────────────────────────────────────────────────
describe('checkInvariant', () => {
  it('blocks write on core files', () => {
    expect(checkInvariant('core/keyManager.ts', 'write')).toBe(false);
    expect(checkInvariant('agentLee.persona.json', 'write')).toBe(false);
    expect(checkInvariant('golden/public.pem', 'write')).toBe(false);
  });

  it('allows read on all files', () => {
    expect(checkInvariant('core/keyManager.ts', 'read')).toBe(true);
    expect(checkInvariant('style.css', 'read')).toBe(true);
  });

  it('allows write on surface files', () => {
    expect(checkInvariant('style.css', 'write')).toBe(true);
    expect(checkInvariant('src/App.tsx', 'write')).toBe(true);
  });

  it('blocks delete on snapshots', () => {
    expect(checkInvariant('snapshots/snapshot_foo.json', 'delete')).toBe(false);
  });
});

describe('classifyFile', () => {
  it('classifies core files correctly', () => {
    expect(classifyFile('core/safeBoot.ts')).toBe('core');
    expect(classifyFile('golden/manifest.json')).toBe('core');
  });

  it('classifies surface files correctly', () => {
    expect(classifyFile('style.css')).toBe('surface');
    expect(classifyFile('game.js')).toBe('surface');
  });

  it('classifies unknown files', () => {
    expect(classifyFile('random/whatever.ts')).toBe('unknown');
  });
});

describe('auditPatch', () => {
  it('returns violations for CORE targets', () => {
    const violations = auditPatch(['core/keyManager.ts', 'style.css'], 'write');
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('core/keyManager.ts');
  });
});

// ── permission.ts ─────────────────────────────────────────────────────────
describe('Edit permissions', () => {
  afterEach(() => revokeEditMode());

  it('grants and validates token for surface files', () => {
    const token = grantEditMode(60_000, 'test-runner', 'surface');
    expect(checkEditPermission(token, 'style.css')).toBe(true);
  });

  it('blocks CORE files with surface-scope token', () => {
    const token = grantEditMode(60_000, 'test-runner', 'surface');
    expect(checkEditPermission(token, 'core/keyManager.ts')).toBe(false);
  });

  it('expired token is rejected', async () => {
    const token = grantEditMode(1, 'test-runner', 'surface'); // 1ms
    await new Promise(r => setTimeout(r, 10));
    expect(getActiveToken()).toBeNull();
    expect(checkEditPermission(token, 'style.css')).toBe(false);
  });
});

// ── patchlog.ts ───────────────────────────────────────────────────────────
describe('Patch log', () => {
  it('logs and updates a patch', () => {
    const before = patchStats().total;
    const id = logPatch({
      description:  'test patch',
      targetFiles:  ['style.css'],
      diff:         '+h1 { color: red; }',
      rollbackPlan: 'revert to snapshot',
      requestedBy:  'vitest',
    });
    expect(typeof id).toBe('string');
    expect(patchStats().total).toBeGreaterThan(before);

    updatePatchStatus(id, 'approved');
    const rec = getPatch(id);
    expect(rec?.status).toBe('approved');
  });
});
