/**
 * AGENT LEE — CREATOR KEY MANAGER
 * Sovereign Access Vault | LEEWAY-CORE-2026
 *
 * The creator's master key grants full system access.
 * The PIN (2912) opens the door to the key input.
 *
 * SECURITY: Only SHA-256 hashes are stored. Plaintext never persists.
 * The real key is known only to the creator.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vault file stored outside repo if possible, falls back to guardian dir
const VAULT_DIR = process.env.GUARDIAN_VAULT_DIR || join(__dirname, '.vault');
const VAULT_FILE = join(VAULT_DIR, '.creator-vault.json');

// Salt for hashing (not a secret — just ensures uniqueness)
const HASH_SALT = 'LEEWAY-SOVEREIGN-2026-SALT';

function hashSecret(value: string): string {
  return createHash('sha256').update(HASH_SALT + value).digest('hex');
}

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

interface VaultData {
  pinHash: string;
  keyHash: string;
  createdAt: string;
  version: string;
}

function loadVault(): VaultData | null {
  if (!existsSync(VAULT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(VAULT_FILE, 'utf8')) as VaultData;
  } catch {
    return null;
  }
}

// Initialize vault with the hashed credentials
// Called once during setup — never stores plaintext
export function initializeVault(pin: string, creatorKey: string): void {
  if (!existsSync(VAULT_DIR)) {
    mkdirSync(VAULT_DIR, { recursive: true });
  }

  const vault: VaultData = {
    pinHash: hashSecret(pin),
    keyHash: hashSecret(creatorKey),
    createdAt: new Date().toISOString(),
    version: 'VAULT-1.0'
  };

  writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), { mode: 0o600 });
  console.log('[CreatorKeyManager] Vault initialized. Plaintext credentials NOT stored.');
}

// Verify PIN — opens the gate to creator key entry
export function verifyPin(pin: string): boolean {
  const vault = loadVault();
  if (!vault) {
    console.warn('[CreatorKeyManager] Vault not initialized.');
    return false;
  }
  return timingSafeCompare(hashSecret(pin), vault.pinHash);
}

// Verify creator key — grants full system access
export function verifyCreatorKey(key: string): boolean {
  const vault = loadVault();
  if (!vault) {
    console.warn('[CreatorKeyManager] Vault not initialized.');
    return false;
  }
  return timingSafeCompare(hashSecret(key), vault.keyHash);
}

// Check if vault exists
export function isVaultReady(): boolean {
  return existsSync(VAULT_FILE);
}

// Generate a session token after successful creator auth
// This token is valid for the current process lifetime only
const SESSION_TOKENS = new Set<string>();
const SESSION_EXPIRY = new Map<string, number>();
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function generateCreatorSession(): string {
  const token = createHash('sha256')
    .update(`CREATOR_SESSION_${Date.now()}_${Math.random()}`)
    .digest('hex');
  SESSION_TOKENS.add(token);
  SESSION_EXPIRY.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isValidCreatorSession(token: string): boolean {
  if (!SESSION_TOKENS.has(token)) return false;
  const expiry = SESSION_EXPIRY.get(token) || 0;
  if (Date.now() > expiry) {
    SESSION_TOKENS.delete(token);
    SESSION_EXPIRY.delete(token);
    return false;
  }
  return true;
}

export function revokeCreatorSession(token: string): void {
  SESSION_TOKENS.delete(token);
  SESSION_EXPIRY.delete(token);
}

export function revokeAllCreatorSessions(): void {
  SESSION_TOKENS.clear();
  SESSION_EXPIRY.clear();
}

export default {
  initializeVault,
  verifyPin,
  verifyCreatorKey,
  isVaultReady,
  generateCreatorSession,
  isValidCreatorSession,
  revokeCreatorSession,
  revokeAllCreatorSessions
};
