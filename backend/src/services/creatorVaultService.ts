/**
 * Creator Vault Service — backend-internal copy
 * Reads from the same vault file as guardian/creatorKeyManager.ts
 * LEEWAY-CORE-2026
 */

import { createHash, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const VAULT_DIR = process.env.GUARDIAN_VAULT_DIR || 'C:/Guardian/.vault';
const VAULT_FILE = join(VAULT_DIR, '.creator-vault.json');
const HASH_SALT = 'LEEWAY-SOVEREIGN-2026-SALT';

interface VaultData {
  pinHash: string;
  keyHash: string;
  createdAt: string;
  version: string;
}

function hashSecret(value: string): string {
  return createHash('sha256').update(HASH_SALT + value).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch { return false; }
}

function loadVault(): VaultData | null {
  if (!existsSync(VAULT_FILE)) return null;
  try { return JSON.parse(readFileSync(VAULT_FILE, 'utf8')); }
  catch { return null; }
}

export const creatorVault = {
  isReady: () => existsSync(VAULT_FILE),

  verifyPin: (pin: string): boolean => {
    const vault = loadVault();
    if (!vault) return false;
    return safeCompare(hashSecret(pin), vault.pinHash);
  },

  verifyKey: (key: string): boolean => {
    const vault = loadVault();
    if (!vault) return false;
    return safeCompare(hashSecret(key), vault.keyHash);
  }
};

// ── In-memory session store ──────────────────────────────────────────────────
const sessions = new Map<string, number>(); // token → expiry ms
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export const creatorSessions = {
  create: (): string => {
    const token = createHash('sha256')
      .update(`CS_${Date.now()}_${Math.random()}`)
      .digest('hex');
    sessions.set(token, Date.now() + TTL_MS);
    return token;
  },

  verify: (token: string): boolean => {
    const expiry = sessions.get(token);
    if (!expiry) return false;
    if (Date.now() > expiry) { sessions.delete(token); return false; }
    return true;
  },

  revoke: (token: string) => sessions.delete(token),

  revokeAll: () => sessions.clear()
};
