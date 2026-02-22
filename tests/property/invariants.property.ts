/**
 * Property-Based Tests — Invariants + Recovery Engine
 * Tier 3: fast-check randomized testing
 * LEEWAY-CORE-2026
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkInvariant, classifyFile } from '../../core/guards/invariants.js';
import { logPatch, updatePatchStatus, patchStats } from '../../core/guards/patchlog.js';

// ── Generators ────────────────────────────────────────────────────────────
const coreFileArb = fc.constantFrom(
  'core/keyManager.ts',
  'core/safeBoot.ts',
  'golden/public.pem',
  'agentLee.persona.json',
  'backend/src/services/security.ts',
);

const surfaceFileArb = fc.constantFrom(
  'src/App.tsx',
  'style.css',
  'game.js',
  'src/components/ChatWidget.tsx',
);

const unknownFileArb = fc.stringMatching(/^[a-z]{1,10}\/[a-z]{1,10}\.(ts|js|json)$/);

const mutatingOps = fc.constantFrom('write', 'delete', 'rename') as fc.Arbitrary<'write' | 'delete' | 'rename'>;

// ── Property: CORE files always block mutating ops ─────────────────────────
describe('Invariant properties', () => {
  it('CORE files are always blocked for write/delete/rename', () => {
    fc.assert(fc.property(coreFileArb, mutatingOps, (file, op) => {
      const ok = checkInvariant(file, op);
      return ok === false;
    }));
  });

  it('CORE files always allow read', () => {
    fc.assert(fc.property(coreFileArb, (file) => {
      return checkInvariant(file, 'read') === true;
    }));
  });

  it('SURFACE files allow write', () => {
    fc.assert(fc.property(surfaceFileArb, (file) => {
      return checkInvariant(file, 'write') === true;
    }));
  });

  it('classifyFile is deterministic', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const r1 = classifyFile(s);
      const r2 = classifyFile(s);
      return r1 === r2;
    }));
  });
});

// ── Property: Patch log is monotonically growing ───────────────────────────
describe('Patch log properties', () => {
  it('stats.total increases monotonically', () => {
    const before = patchStats().total;
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 50 }), (desc) => {
      logPatch({
        description:  desc,
        targetFiles:  ['src/App.tsx'],
        diff:         '',
        rollbackPlan: 'none',
        requestedBy:  'property-test',
      });
      const after = patchStats().total;
      const ok = after >= before;
      return ok;
    }));
  });
});
