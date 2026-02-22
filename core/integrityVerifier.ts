/**
 * Agent Lee — Integrity Verifier
 * Layer 4: Boot-time file hash verification against manifest
 * LEEWAY-CORE-2026
 *
 * Generates and verifies a signed manifest of all core files.
 * On startup: if any mismatch → LOCKDOWN.
 *
 * CLI:
 *   tsx core/integrityVerifier.ts generate  → writes golden/manifest.json
 *   tsx core/integrityVerifier.ts verify    → checks current vs manifest
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { signPayload, verifySignature, hasKeypair, getPublicKeyFingerprint } from './keyManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

export const MANIFEST_PATH = path.resolve(__dirname, '../golden/manifest.json');

// ── Files that must be verified on every boot ─────────────────────────────
const CORE_FILES_PATTERNS = [
  'core/',
  'backend/src/layers/',
  'backend/src/services/security.ts',
  'backend/src/services/terminal-policy.ts',
  'backend/src/services/terminal-audit.ts',
  'backend/src/index.ts',
  'agentLee.persona.json',
];

function globCoreFiles(): string[] {
  const result: string[] = [];
  for (const pattern of CORE_FILES_PATTERNS) {
    const full = path.join(ROOT, pattern);
    if (pattern.endsWith('/')) {
      if (!fs.existsSync(full)) continue;
      collectFiles(full, result);
    } else {
      if (fs.existsSync(full)) result.push(full);
    }
  }
  return result;
}

function collectFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/(node_modules|__pycache__|\.git)/.test(entry.name)) {
        collectFiles(full, out);
      }
    } else if (/\.(ts|js|json|py|ps1)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

export interface Manifest {
  generated_at:  string;
  key_fingerprint: string;
  files:         Record<string, string>;   // relative path → sha256
  manifest_hash: string;
  signature:     string | null;
}

// ── Generate manifest ─────────────────────────────────────────────────────
export function generateManifest(sign = true): Manifest {
  const files: Record<string, string> = {};
  for (const f of globCoreFiles()) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    files[rel] = hash;
  }

  const fileList = Object.keys(files).sort().map(k => `${k}:${files[k]}`).join('\n');
  const manifest_hash = crypto.createHash('sha256').update(fileList).digest('hex');

  let signature: string | null = null;
  if (sign && hasKeypair()) {
    signature = signPayload(manifest_hash);
  }

  const manifest: Manifest = {
    generated_at:    new Date().toISOString(),
    key_fingerprint: getPublicKeyFingerprint(),
    files,
    manifest_hash,
    signature,
  };

  const goldenDir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(goldenDir)) fs.mkdirSync(goldenDir, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`  📋  Manifest generated: ${Object.keys(files).length} files`);
  console.log(`  🔑  Hash: ${manifest_hash.substring(0, 16)}…`);
  return manifest;
}

// ── Verify ────────────────────────────────────────────────────────────────
export interface IntegrityResult {
  valid:       boolean;
  compromised: string[];      // files with hash mismatch
  missing:     string[];      // files listed in manifest but gone
  new_files:   string[];      // files present but not in manifest
  signature_ok: boolean | null;
}

export function verifyIntegrity(): IntegrityResult {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.warn('  ⚠  No manifest found. Run: tsx core/integrityVerifier.ts generate');
    return { valid: false, compromised: [], missing: [], new_files: [], signature_ok: null };
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  // Verify manifest signature
  let signature_ok: boolean | null = null;
  if (manifest.signature && hasKeypair()) {
    signature_ok = verifySignature(manifest.manifest_hash, manifest.signature);
    if (!signature_ok) {
      console.error('  ❌  MANIFEST SIGNATURE INVALID — manifest may be tampered!');
    }
  }

  const compromised: string[] = [];
  const missing:     string[] = [];

  for (const [rel, expected] of Object.entries(manifest.files)) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      missing.push(rel);
    } else {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      if (actual !== expected) {
        compromised.push(rel);
      }
    }
  }

  // Detect new files in core that aren't in manifest
  const currentFiles = globCoreFiles().map(f => path.relative(ROOT, f).replace(/\\/g, '/'));
  const new_files = currentFiles.filter(f => !manifest.files[f]);

  const valid = compromised.length === 0 && missing.length === 0 && signature_ok !== false;
  return { valid, compromised, missing, new_files, signature_ok };
}

// ── Quick boot check (call from sovereign-boot-manager) ───────────────────
export function bootIntegrityCheck(): void {
  console.log('  [IntegrityVerifier] Running boot check…');
  const result = verifyIntegrity();

  if (result.valid) {
    console.log('  ✅  Integrity verified. Core is clean.');
    return;
  }

  if (result.compromised.length) {
    console.error('  🔴  TAMPERED FILES:',   result.compromised);
  }
  if (result.missing.length) {
    console.error('  🔴  MISSING FILES:',    result.missing);
  }
  if (result.new_files.length) {
    console.warn( '  ⚠   UNREGISTERED FILES:', result.new_files);
  }

  if (result.compromised.length || result.missing.length) {
    console.error('  🔴  INTEGRITY FAILURE — entering LOCKDOWN');
    process.env.AGENT_LEE_LOCKDOWN = 'true';
    // Caller (safeBoot) decides whether to hard-exit or degrade
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('integrityVerifier')) {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'generate') {
    generateManifest(true);
  } else if (cmd === 'verify') {
    const result = verifyIntegrity();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  } else {
    console.log('Usage: tsx core/integrityVerifier.ts [generate|verify]');
  }
}
