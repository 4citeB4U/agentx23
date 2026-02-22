/**
 * Agent Lee — Snapshot Manager
 * Layer 2: Time-based recovery + state versioning
 * LEEWAY-CORE-2026
 *
 * Every meaningful change triggers:
 *   snapshot() → apply change → test → commit() or revert()
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { signPayload, verifySignature, hasKeypair } from './keyManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SNAPSHOT_DIR  = path.resolve(__dirname, '../snapshots');
export const GOLDEN_DIR    = path.resolve(__dirname, '../golden');

if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
if (!fs.existsSync(GOLDEN_DIR))   fs.mkdirSync(GOLDEN_DIR,   { recursive: true });

export interface Snapshot {
  snapshot_id:   string;
  timestamp:     string;
  label:         string;
  hash_tree:     Record<string, string>;   // relative-path → sha256
  core_hash:     string;                   // aggregate hash of all tracked files
  modules:       string[];
  db_schema_ver: string;
  signature:     string | null;            // signed by creator key (optional)
}

// ── Hash helpers ──────────────────────────────────────────────────────────
export function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'MISSING';
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function hashDirectory(dir: string, base = dir): Record<string, string> {
  const tree: Record<string, string> = {};
  if (!fs.existsSync(dir)) return tree;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel  = path.relative(base, full).replace(/\\/g, '/');
    // Skip node_modules, .git, snapshots, quarantine
    if (/node_modules|\.git|snapshots|quarantine|\.env/.test(rel)) continue;
    if (entry.isDirectory()) {
      Object.assign(tree, hashDirectory(full, base));
    } else {
      tree[rel] = hashFile(full);
    }
  }
  return tree;
}

function aggregateHash(tree: Record<string, string>): string {
  const sorted = Object.keys(tree).sort().map(k => `${k}:${tree[k]}`).join('\n');
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

// ── Core directories to snapshot ──────────────────────────────────────────
const TRACKED_DIRS = [
  path.resolve(__dirname, '../core'),
  path.resolve(__dirname, '../backend/src'),
];

// ── Create snapshot ───────────────────────────────────────────────────────
export function createSnapshot(label = 'auto', sign = false): Snapshot {
  const hash_tree: Record<string, string> = {};

  for (const dir of TRACKED_DIRS) {
    Object.assign(hash_tree, hashDirectory(dir, path.resolve(__dirname, '..')));
  }

  const core_hash = aggregateHash(hash_tree);
  const snapshot_id = crypto.randomUUID();
  const timestamp   = new Date().toISOString();

  // Detect active modules from backend/src/layers
  const layersDir = path.resolve(__dirname, '../backend/src/layers');
  const modules = fs.existsSync(layersDir)
    ? fs.readdirSync(layersDir).filter(f => f.endsWith('.ts')).map(f => f.replace('.ts', ''))
    : [];

  let signature: string | null = null;
  if (sign && hasKeypair()) {
    signature = signPayload(`${snapshot_id}:${core_hash}`);
  }

  const snap: Snapshot = {
    snapshot_id, timestamp, label, hash_tree, core_hash, modules,
    db_schema_ver: process.env.INSFORGE_SCHEMA_VERSION || '1.0',
    signature,
  };

  const file = path.join(SNAPSHOT_DIR, `snapshot_${timestamp.replace(/[:.]/g, '-')}_${label}.json`);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  console.log(`  📦  Snapshot created: ${path.basename(file)}`);
  return snap;
}

// ── Load latest snapshot ──────────────────────────────────────────────────
export function getLatestSnapshot(): Snapshot | null {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  if (!files.length) return null;
  return JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, files[files.length - 1]), 'utf8'));
}

export function listSnapshots(): Array<{ file: string; snapshot: Snapshot }> {
  return fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => ({
      file: f,
      snapshot: JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8')) as Snapshot,
    }));
}

// ── Verify a snapshot's signature ─────────────────────────────────────────
export function verifySnapshotSignature(snap: Snapshot): boolean {
  if (!snap.signature) return false;
  return verifySignature(`${snap.snapshot_id}:${snap.core_hash}`, snap.signature);
}

// ── Verify current state against a snapshot ───────────────────────────────
export function diffSnapshot(snap: Snapshot): {
  added: string[]; removed: string[]; modified: string[];
} {
  const current: Record<string, string> = {};
  for (const dir of TRACKED_DIRS) {
    Object.assign(current, hashDirectory(dir, path.resolve(__dirname, '..')));
  }

  const added    = Object.keys(current).filter(k => !snap.hash_tree[k]);
  const removed  = Object.keys(snap.hash_tree).filter(k => !current[k]);
  const modified = Object.keys(current).filter(k => snap.hash_tree[k] && snap.hash_tree[k] !== current[k]);

  return { added, removed, modified };
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('snapshotManager')) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'create') {
    const s = createSnapshot(args[0] || 'cli', args.includes('--sign'));
    console.log(`  core_hash: ${s.core_hash.substring(0, 16)}…`);
  } else if (cmd === 'list') {
    for (const { file, snapshot: s } of listSnapshots().slice(0, 10)) {
      console.log(`  ${s.timestamp.substring(0, 19)}  ${s.label.padEnd(20)}  ${s.core_hash.substring(0, 12)}…  ${file}`);
    }
  } else if (cmd === 'diff') {
    const snap = getLatestSnapshot();
    if (!snap) { console.log('No snapshots.'); process.exit(1); }
    const d = diffSnapshot(snap);
    console.log('Added:',    d.added);
    console.log('Removed:',  d.removed);
    console.log('Modified:', d.modified);
  } else {
    console.log('Usage: tsx core/snapshotManager.ts [create [label] [--sign] | list | diff]');
  }
}
