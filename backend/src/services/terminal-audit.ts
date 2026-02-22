/**
 * Agent Lee — Terminal Audit Logger
 * LEEWAY-CORE-2026 | Every command + output hash is stored
 *
 * Storage:
 *  - In-memory ring buffer (fast, last 5 000 events)
 *  - InsForge telemetry_events table (async, non-blocking)
 */

import { createClient } from '@insforge/sdk';
import crypto from 'crypto';
import { sanitiseForLog } from './terminal-policy.js';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

const AUDIT_ENABLED = process.env.TERMINAL_AUDIT !== 'false';

export interface AuditEvent {
  id:           string;
  sessionId:    string;
  target:       'host' | 'vm';
  command:      string;
  cwd:          string;
  exitCode?:    number;
  outputHash:   string;      // SHA-256 of raw output (integrity check)
  outputSnippet: string;     // first 500 chars of output
  risk:         string;
  allowed:      boolean;
  user:         string;
  timestamp:    string;
}

// ── In-memory ring buffer ─────────────────────────────────────────────────
const RING_SIZE = 5_000;
const ring: AuditEvent[] = [];
const bySession = new Map<string, AuditEvent[]>();

function addToRing(e: AuditEvent): void {
  if (ring.length >= RING_SIZE) ring.shift();
  ring.push(e);

  if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
  const ses = bySession.get(e.sessionId)!;
  if (ses.length > 500) ses.shift();
  ses.push(e);
}

// ── Hash helper ───────────────────────────────────────────────────────────
export function hashOutput(output: string): string {
  return crypto.createHash('sha256').update(output).digest('hex').substring(0, 16);
}

// ── Log a terminal event ──────────────────────────────────────────────────
export async function auditLog(event: Omit<AuditEvent, 'id' | 'timestamp' | 'outputHash'> & {
  rawOutput?: string;
}): Promise<AuditEvent> {
  const full: AuditEvent = {
    id:            crypto.randomUUID(),
    timestamp:     new Date().toISOString(),
    outputHash:    hashOutput(event.rawOutput || event.outputSnippet),
    sessionId:     event.sessionId,
    target:        event.target,
    command:       sanitiseForLog(event.command),
    cwd:           event.cwd,
    exitCode:      event.exitCode,
    outputSnippet: (event.rawOutput || event.outputSnippet).substring(0, 500),
    risk:          event.risk,
    allowed:       event.allowed,
    user:          event.user,
  };

  addToRing(full);

  // Async persist to InsForge (non-blocking — don't throw on failure)
  if (AUDIT_ENABLED) {
    setImmediate(async () => {
      try {
        await insforge.database.from('telemetry_events').insert([{
          event_type: 'terminal_command',
          task_id:    `terminal_${full.sessionId}`,
          metadata:   full,
        }]).select();
      } catch {
        // Insforge unavailable — ring buffer is the backup
      }
    });
  }

  return full;
}

// ── Query helpers ─────────────────────────────────────────────────────────
export function getAuditBySession(sessionId: string): AuditEvent[] {
  return bySession.get(sessionId) || [];
}

export function getAuditSnapshot(sessionId: string, lastN = 50): {
  events: AuditEvent[];
  count:  number;
  hashes: string[];
} {
  const events = (bySession.get(sessionId) || []).slice(-lastN);
  return {
    events,
    count:  events.length,
    hashes: events.map(e => e.outputHash),
  };
}

export function getAllAudit(limit = 200): AuditEvent[] {
  return ring.slice(-limit);
}
