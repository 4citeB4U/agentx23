/**
 * Agent Lee — Quarantine Manager
 * Layer 3: Forensic isolation of compromised files/directories
 * LEEWAY-CORE-2026
 *
 * When corruption is detected:
 *  1. Clone target to /quarantine/<name>_<timestamp>/
 *  2. Remove or disable original
 *  3. Preserve for forensic analysis
 *  4. Emit quarantine event to audit log
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, '..');
export const QUARANTINE_DIR = path.resolve(ROOT, 'quarantine');

if (!fs.existsSync(QUARANTINE_DIR)) fs.mkdirSync(QUARANTINE_DIR, { recursive: true });

export interface QuarantineEvent {
  id:           string;
  timestamp:    string;
  source_path:  string;
  dest_path:    string;
  reason:       string;
  file_hashes:  Record<string, string>;
}

const QUARANTINE_LOG = path.join(QUARANTINE_DIR, 'quarantine.log.json');

function loadLog(): QuarantineEvent[] {
  if (!fs.existsSync(QUARANTINE_LOG)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUARANTINE_LOG, 'utf8'));
  } catch {
    return [];
  }
}

function appendLog(event: QuarantineEvent): void {
  const log = loadLog();
  log.push(event);
  fs.writeFileSync(QUARANTINE_LOG, JSON.stringify(log, null, 2));
}

function hashPath(p: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  if (!fs.existsSync(p)) return hashes;
  if (fs.statSync(p).isFile()) {
    hashes[path.basename(p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  } else {
    for (const f of fs.readdirSync(p)) {
      const full = path.join(p, f);
      if (fs.statSync(full).isFile()) {
        hashes[f] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      }
    }
  }
  return hashes;
}

function copyRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dest, f));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// ── Main quarantine function ──────────────────────────────────────────────
export function quarantine(targetPath: string, reason: string): QuarantineEvent {
  const abs    = path.resolve(targetPath);
  const name   = path.basename(abs);
  const ts     = Date.now();
  const destDir = path.join(QUARANTINE_DIR, `${name}_${ts}`);

  // Clone to quarantine (preserve for forensics)
  copyRecursive(abs, destDir);

  const event: QuarantineEvent = {
    id:          crypto.randomUUID(),
    timestamp:   new Date().toISOString(),
    source_path: abs,
    dest_path:   destDir,
    reason,
    file_hashes: hashPath(abs),
  };

  appendLog(event);

  // Write an incident README inside the quarantine copy
  fs.writeFileSync(path.join(destDir, '_QUARANTINE_README.txt'),
    `QUARANTINE EVENT\n` +
    `ID:        ${event.id}\n` +
    `Timestamp: ${event.timestamp}\n` +
    `Source:    ${event.source_path}\n` +
    `Reason:    ${event.reason}\n` +
    `\nThis copy is preserved for forensic analysis only.\n` +
    `Do NOT restore without integrity verification.\n`
  );

  console.warn(`  🚨  Quarantined: ${abs}`);
  console.warn(`  📂  Preserved at: ${destDir}`);
  console.warn(`  Reason: ${reason}`);

  return event;
}

// ── List quarantine events ─────────────────────────────────────────────────
export function listQuarantineEvents(): QuarantineEvent[] {
  return loadLog();
}

// ── Check if a file is quarantined ────────────────────────────────────────
export function isQuarantined(targetPath: string): boolean {
  const abs = path.resolve(targetPath);
  return loadLog().some(e => e.source_path === abs);
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('quarantineManager')) {
  const [cmd, target, reason] = process.argv.slice(2);
  if (cmd === 'quarantine' && target) {
    quarantine(target, reason || 'manual quarantine');
  } else if (cmd === 'list') {
    const events = listQuarantineEvents();
    events.forEach(e => console.log(`  ${e.timestamp.substring(0, 19)}  ${e.source_path}  — ${e.reason}`));
    console.log(`\n  Total: ${events.length} quarantine events`);
  } else {
    console.log('Usage: tsx core/quarantineManager.ts [quarantine <path> [reason] | list]');
  }
}
