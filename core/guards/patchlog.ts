/**
 * Agent Lee — Patch Audit Log
 * Append-only ledger of every patch operation
 * LEEWAY-CORE-2026
 *
 * Every patch record contains:
 *  - patchId       : UUID
 *  - timestamp     : ISO 8601
 *  - description   : human text
 *  - targetFiles   : files touched
 *  - diff          : textual diff (optional)
 *  - rollbackPlan  : snapshot_id or instructions
 *  - status        : pending | approved | reverted
 *  - requestedBy   : agent-lee | creator | <user>
 *  - preflightResults : TestResult[]
 *
 * Log is append-only. Status may be updated (pending → approved|reverted).
 * Records are NEVER deleted.
 */

import crypto from 'crypto';
import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..', '..');
const LOG_PATH   = path.join(ROOT, 'workspace', 'patchlog.json');

// ── Types ─────────────────────────────────────────────────────────────────
export type PatchStatus = 'pending' | 'approved' | 'reverted';

export interface PatchRecord {
  patchId:          string;
  timestamp:        string;
  description:      string;
  targetFiles:      string[];
  diff:             string;
  rollbackPlan:     string;
  status:           PatchStatus;
  requestedBy:      string;
  preflightResults: Array<{ name: string; passed: boolean; output: string }>;
}

// ── Log I/O ───────────────────────────────────────────────────────────────
function loadLog(): PatchRecord[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveLog(records: PatchRecord[]): void {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(records, null, 2));
}

// ── Append a patch record ─────────────────────────────────────────────────
export function logPatch(patch: Omit<PatchRecord, 'patchId' | 'timestamp' | 'status' | 'preflightResults'>): string {
  const record: PatchRecord = {
    patchId:          crypto.randomUUID(),
    timestamp:        new Date().toISOString(),
    status:           'pending',
    preflightResults: [],
    ...patch,
  };
  const log = loadLog();
  log.push(record);
  saveLog(log);
  console.log(`  [PatchLog] Logged patch ${record.patchId}: ${record.description}`);
  return record.patchId;
}

// ── Update status + preflight results ────────────────────────────────────
export function updatePatchStatus(
  patchId:          string,
  status:           PatchStatus,
  preflightResults?: PatchRecord['preflightResults'],
): boolean {
  const log = loadLog();
  const idx = log.findIndex(r => r.patchId === patchId);
  if (idx === -1) {
    console.warn(`  [PatchLog] Patch ${patchId} not found.`);
    return false;
  }
  log[idx].status = status;
  if (preflightResults) log[idx].preflightResults = preflightResults;
  saveLog(log);
  console.log(`  [PatchLog] Patch ${patchId} → ${status}`);
  return true;
}

// ── Query ─────────────────────────────────────────────────────────────────
export function getPatches(filter?: { status?: PatchStatus; file?: string }): PatchRecord[] {
  let log = loadLog();
  if (filter?.status) log = log.filter(r => r.status === filter.status);
  if (filter?.file)   log = log.filter(r => r.targetFiles.includes(filter.file!));
  return log;
}

export function getPatch(patchId: string): PatchRecord | null {
  return loadLog().find(r => r.patchId === patchId) ?? null;
}

// ── Statistics ────────────────────────────────────────────────────────────
export function patchStats(): { total: number; approved: number; reverted: number; pending: number } {
  const log = loadLog();
  return {
    total:    log.length,
    approved: log.filter(r => r.status === 'approved').length,
    reverted: log.filter(r => r.status === 'reverted').length,
    pending:  log.filter(r => r.status === 'pending').length,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes('patchlog')) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'list') {
    const patches = getPatches();
    if (!patches.length) { console.log('  No patches logged.'); process.exit(0); }
    for (const p of patches) {
      const icon = p.status === 'approved' ? '✅' : p.status === 'reverted' ? '↩️' : '⏳';
      console.log(`  ${icon}  [${p.patchId.substring(0,8)}] ${p.timestamp.substring(0,19)}  ${p.description}  → ${p.status}`);
    }
  } else if (cmd === 'stats') {
    console.log(JSON.stringify(patchStats(), null, 2));
  } else if (cmd === 'show' && args[0]) {
    const p = getPatch(args[0]);
    console.log(p ? JSON.stringify(p, null, 2) : '  Patch not found.');
  } else {
    console.log('Usage: tsx core/guards/patchlog.ts [list | stats | show <patchId>]');
  }
}
