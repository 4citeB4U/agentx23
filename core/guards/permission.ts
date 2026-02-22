/**
 * Agent Lee — Edit Permission Guard
 * Time-limited, layer-scoped authorization for self-modification
 * LEEWAY-CORE-2026
 *
 * Only surface-layer files can be patched by Agent Lee autonomously.
 * Core files require a resurrection-level creator signature.
 *
 * Token lifecycle:
 *   1. Creator/AI requests token:  grantEditMode(durationMs)
 *   2. Patch system checks token:  checkEditPermission(token, file)
 *   3. After patch (or timeout):   revokeEditMode()
 */

import crypto from 'crypto';
import { classifyFile } from './invariants.js';

export interface EditModeToken {
  id:          string;
  granted_at:  number;  // epoch ms
  expires_at:  number;  // epoch ms
  granted_by:  string;
  scope:       'surface' | 'full'; // 'full' requires resurrection proof
}

// In-memory token store (one active token at a time)
let ACTIVE_TOKEN: EditModeToken | null = null;

// ── Grant ─────────────────────────────────────────────────────────────────
export function grantEditMode(
  durationMs = 5 * 60 * 1000,
  grantedBy  = 'agent-lee',
  scope: EditModeToken['scope'] = 'surface',
): EditModeToken {
  if (ACTIVE_TOKEN && Date.now() < ACTIVE_TOKEN.expires_at) {
    // Revoke existing before issuing new one
    console.warn(`  [Permission] Revoking existing token ${ACTIVE_TOKEN.id} before new grant.`);
  }

  const now = Date.now();
  ACTIVE_TOKEN = {
    id:         crypto.randomUUID(),
    granted_at: now,
    expires_at: now + durationMs,
    granted_by: grantedBy,
    scope,
  };

  console.log(`  [Permission] Edit token granted: ${ACTIVE_TOKEN.id}`);
  console.log(`  Scope: ${scope} | Expires: ${new Date(ACTIVE_TOKEN.expires_at).toISOString()}`);
  return { ...ACTIVE_TOKEN };
}

// ── Revoke ────────────────────────────────────────────────────────────────
export function revokeEditMode(): void {
  if (ACTIVE_TOKEN) {
    console.log(`  [Permission] Edit token revoked: ${ACTIVE_TOKEN.id}`);
    ACTIVE_TOKEN = null;
  }
}

// ── Get current token ─────────────────────────────────────────────────────
export function getActiveToken(): EditModeToken | null {
  if (!ACTIVE_TOKEN) return null;
  if (Date.now() > ACTIVE_TOKEN.expires_at) {
    console.log(`  [Permission] Token ${ACTIVE_TOKEN.id} expired.`);
    ACTIVE_TOKEN = null;
    return null;
  }
  return { ...ACTIVE_TOKEN };
}

// ── Check permission for a specific file ─────────────────────────────────
export function checkEditPermission(token: EditModeToken, relPath: string): boolean {
  // Must have active token matching id
  const active = getActiveToken();
  if (!active || active.id !== token.id) {
    console.warn(`  [Permission] Token mismatch or expired: ${token.id}`);
    return false;
  }

  const layer = classifyFile(relPath);

  // Surface scope → only surface/unknown files
  if (active.scope === 'surface' && layer === 'core') {
    console.warn(`  [Permission] DENIED: surface-scope token cannot touch CORE file: ${relPath}`);
    return false;
  }

  // Full scope → allowed on surface; core still needs invariant check upstream
  return true;
}

// ── Token status summary ──────────────────────────────────────────────────
export function getTokenStatus(): object {
  const tok = getActiveToken();
  if (!tok) return { active: false };
  const remaining = Math.max(0, tok.expires_at - Date.now());
  return {
    active:          true,
    id:              tok.id,
    scope:           tok.scope,
    granted_by:      tok.granted_by,
    expires_in_sec:  Math.floor(remaining / 1000),
    expires_at:      new Date(tok.expires_at).toISOString(),
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('permission')) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'grant') {
    const ms  = parseInt(arg || '300000', 10);
    const tok = grantEditMode(ms);
    console.log(JSON.stringify(tok, null, 2));
  } else if (cmd === 'status') {
    console.log(JSON.stringify(getTokenStatus(), null, 2));
  } else if (cmd === 'revoke') {
    revokeEditMode();
  } else {
    console.log('Usage: tsx core/guards/permission.ts [grant [ms] | status | revoke]');
  }
}
