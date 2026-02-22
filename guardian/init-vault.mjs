// Guardian Vault Initializer — run once with: node guardian/init-vault.mjs
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const VAULT_DIR = process.env.GUARDIAN_VAULT_DIR || 'C:/Guardian/.vault';
const VAULT_FILE = join(VAULT_DIR, '.creator-vault.json');
const HASH_SALT = 'LEEWAY-SOVEREIGN-2026-SALT';

function hashSecret(v) {
  return createHash('sha256').update(HASH_SALT + v).digest('hex');
}

const PIN = process.env.CREATOR_PIN || '2912';
const KEY = process.env.CREATOR_KEY || 'Eyecyou2912LeonardLee08162116Jerome';

if (existsSync(VAULT_FILE)) {
  console.log('Vault already exists at:', VAULT_FILE);
  process.exit(0);
}

if (!existsSync(VAULT_DIR)) mkdirSync(VAULT_DIR, { recursive: true });

const vault = {
  pinHash: hashSecret(PIN),
  keyHash: hashSecret(KEY),
  createdAt: new Date().toISOString(),
  version: 'VAULT-1.0'
};

writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
console.log('✅ Vault initialized at:', VAULT_FILE);
console.log('   PIN hash (first 12): ' + vault.pinHash.slice(0, 12) + '...');
console.log('   KEY hash (first 12): ' + vault.keyHash.slice(0, 12) + '...');
console.log('   Plaintext credentials: NOT STORED');
console.log('\n⚠️  You can now remove CREATOR_PIN and CREATOR_KEY from .env.local');
