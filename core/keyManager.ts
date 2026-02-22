/**
 * Agent Lee — Key Manager
 * RSA-4096 sovereign keypair for resurrection authority
 * LEEWAY-CORE-2026
 *
 * Usage:
 *   npx tsx core/keyManager.ts generate      → creates golden/public.pem + golden/private.pem
 *   npx tsx core/keyManager.ts sign <payload> → prints base64 signature
 *   npx tsx core/keyManager.ts verify <payload> <sig> → exits 0=valid 1=invalid
 *
 * SECURITY: Move golden/private.pem offline after generation.
 *           Only golden/public.pem remains on the server.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN_DIR = path.resolve(__dirname, '../golden');
export const PUB_KEY    = path.join(GOLDEN_DIR, 'public.pem');
export const PRIV_KEY   = path.join(GOLDEN_DIR, 'private.pem');

// ── Key Generation ────────────────────────────────────────────────────────
export function generateKeypair(force = false): void {
  if (!fs.existsSync(GOLDEN_DIR)) fs.mkdirSync(GOLDEN_DIR, { recursive: true });

  if (!force && fs.existsSync(PUB_KEY)) {
    console.log('  Keypair already exists. Use --force to regenerate.');
    return;
  }

  console.log('  Generating RSA-4096 keypair (this takes ~5 seconds)…');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PUB_KEY,  publicKey,  { mode: 0o644 });
  fs.writeFileSync(PRIV_KEY, privateKey, { mode: 0o600 });

  console.log(`  ✅  Public key:  ${PUB_KEY}`);
  console.log(`  ⚠   Private key: ${PRIV_KEY}`);
  console.log('  ⚠   ACTION REQUIRED: Move private.pem offline. Keep only public.pem on server.');
}

// ── Signing (requires private key — creator only) ─────────────────────────
export function signPayload(payload: string, privKeyPath = PRIV_KEY): string {
  if (!fs.existsSync(privKeyPath)) {
    throw new Error(`Private key not found at ${privKeyPath}. Cannot sign.`);
  }
  const privateKey = fs.readFileSync(privKeyPath, 'utf8');
  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

// ── Verification (public key only — server-side) ──────────────────────────
export function verifySignature(payload: string, signature: string, pubKeyPath = PUB_KEY): boolean {
  if (!fs.existsSync(pubKeyPath)) {
    throw new Error(`Public key not found at ${pubKeyPath}. Cannot verify.`);
  }
  const publicKey = fs.readFileSync(pubKeyPath, 'utf8');
  const verify = crypto.createVerify('SHA256');
  verify.update(payload);
  verify.end();
  try {
    return verify.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

// ── Key fingerprint (for display / comparison) ───────────────────────────
export function getPublicKeyFingerprint(): string {
  if (!fs.existsSync(PUB_KEY)) return 'NOT_GENERATED';
  const key = fs.readFileSync(PUB_KEY, 'utf8');
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

export function hasKeypair(): boolean {
  return fs.existsSync(PUB_KEY);
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('keyManager')) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'generate') {
    generateKeypair(args.includes('--force'));
  } else if (cmd === 'sign' && args[0]) {
    const sig = signPayload(args[0]);
    console.log('Signature:', sig);
  } else if (cmd === 'verify' && args[0] && args[1]) {
    const ok = verifySignature(args[0], args[1]);
    console.log(ok ? '✅ VALID' : '❌ INVALID');
    process.exit(ok ? 0 : 1);
  } else if (cmd === 'fingerprint') {
    console.log('Public key fingerprint:', getPublicKeyFingerprint());
  } else {
    console.log('Usage: tsx core/keyManager.ts [generate|sign <payload>|verify <payload> <sig>|fingerprint]');
  }
}
