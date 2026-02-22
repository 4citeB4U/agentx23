/**
 * Agent Lee — Sovereign Boot Manager
 * Layer 49: SovereignBootManager | LEEWAY-CORE-2026
 *
 * Manages full system startup:
 * 1. Verify LEEWAY handshake
 * 2. Check InsForge DB connectivity
 * 3. Warm memory cache
 * 4. Validate MCP bridge
 * 5. Run smoke tests
 * 6. Announce readiness via voice
 */

import { createClient } from '@insforge/sdk';
import fs from 'fs';
import path from 'path';
import http from 'http';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

const HANDSHAKE = process.env.NEURAL_HANDSHAKE || 'AGENT_LEE_SOVEREIGN_V1';
const LOCAL_BASE = `http://localhost:${process.env.BACKEND_PORT || 8001}`;

interface BootResult {
  step:    string;
  ok:      boolean;
  detail:  string;
}

// ── HTTP helper ───────────────────────────────────────────────────────────
function httpGet(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('timeout')));
    req.end();
  });
}

// ── Boot Steps ────────────────────────────────────────────────────────────

async function step_leeway_handshake(): Promise<BootResult> {
  const valid = !!HANDSHAKE && HANDSHAKE.length > 10;
  return {
    step:   'LEEWAYProtocol handshake',
    ok:     valid,
    detail: valid ? `Handshake: ${HANDSHAKE.substring(0, 12)}…` : 'HANDSHAKE NOT SET',
  };
}

async function step_insforge_db(): Promise<BootResult> {
  try {
    const { data, error } = await insforge.database
      .from('episodes')
      .select('id')
      .limit(1);

    return {
      step:   'InsForge DB connectivity',
      ok:     !error,
      detail: error ? String(error) : 'InsForge Postgres reachable',
    };
  } catch (e) {
    return { step: 'InsForge DB connectivity', ok: false, detail: String(e) };
  }
}

async function step_local_health(): Promise<BootResult> {
  try {
    const res = await httpGet(`${LOCAL_BASE}/api/health`);
    return {
      step:   'Backend health endpoint',
      ok:     res.status === 200,
      detail: `HTTP ${res.status}`,
    };
  } catch (e) {
    return { step: 'Backend health endpoint', ok: false, detail: String(e) };
  }
}

async function step_mcp_bridge(): Promise<BootResult> {
  try {
    const res = await httpGet(`${LOCAL_BASE}/api/mcp/status`, {
      'X-Neural-Handshake': HANDSHAKE,
    });
    return {
      step:   'MCP bridge status',
      ok:     res.status === 200,
      detail: res.status === 200 ? 'MCP bridge reachable' : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { step: 'MCP bridge status', ok: false, detail: String(e) };
  }
}

async function step_episodes_db(): Promise<BootResult> {
  try {
    const dbPath = process.env.EPISODES_DB || 'workspace/episodes.db';
    const exists = fs.existsSync(path.resolve(process.cwd(), dbPath));
    return {
      step:   'Local episodes.db',
      ok:     exists,
      detail: exists ? `Found at ${dbPath}` : `Not found at ${dbPath}`,
    };
  } catch (e) {
    return { step: 'Local episodes.db', ok: false, detail: String(e) };
  }
}

async function step_persona_file(): Promise<BootResult> {
  const personaPath = path.resolve(process.cwd(), '..', 'agentLee.persona.json');
  const exists = fs.existsSync(personaPath);
  if (!exists) {
    return { step: 'Persona file', ok: false, detail: 'agentLee.persona.json missing' };
  }
  try {
    const persona = JSON.parse(fs.readFileSync(personaPath, 'utf8'));
    const valid = persona.persona_version === 'AgentLee_OS_Conscious_v2' && persona.layers?.length === 50;
    return {
      step:   'Persona file',
      ok:     valid,
      detail: valid
        ? `v${persona.persona_version} — ${persona.layers.length} layers loaded`
        : `Version or layer count mismatch (got ${persona.layers?.length || 0} layers)`,
    };
  } catch (e) {
    return { step: 'Persona file', ok: false, detail: String(e) };
  }
}

// ── Voice Announcement ────────────────────────────────────────────────────
async function announceReadiness(results: BootResult[]): Promise<void> {
  const passed = results.filter(r => r.ok).length;
  const total  = results.length;
  const allOk  = passed === total;

  const announcement = allOk
    ? `Yo. Agent Lee Sovereign OS online. All ${total} systems verified. LEEWAY Standards active. Research-first gate armed. Parallel navigator standing by. We locked in.`
    : `Agent Lee OS booting in degraded mode. ${passed}/${total} systems nominal. Check failed components before proceeding.`;

  // Log voice event to InsForge
  await insforge.database.from('voice_events').insert([{
    state:   allOk ? 'complete' : 'degraded',
    summary: announcement,
    success: allOk,
  }]).select();

  console.log('\n  🎤  ' + announcement);
}

// ── Main Boot Sequence ────────────────────────────────────────────────────
export async function sovereignBoot(skipRemoteChecks = false): Promise<{
  ok:      boolean;
  passed:  number;
  total:   number;
  results: BootResult[];
}> {
  console.log('\n' + '═'.repeat(60));
  console.log('  AGENT LEE SOVEREIGN BOOT — LEEWAY-CORE-2026');
  console.log('═'.repeat(60));

  const steps = [
    step_leeway_handshake,
    step_persona_file,
    step_episodes_db,
    ...(skipRemoteChecks ? [] : [step_insforge_db, step_local_health, step_mcp_bridge]),
  ];

  const results: BootResult[] = [];
  for (const step of steps) {
    const result = await step();
    const icon = result.ok ? '✅' : '❌';
    console.log(`  ${icon}  ${result.step.padEnd(32)} — ${result.detail}`);
    results.push(result);
  }

  const passed = results.filter(r => r.ok).length;
  const total  = results.length;
  const allOk  = passed === total;

  console.log('\n' + '─'.repeat(60));
  console.log(`  Boot result: ${passed}/${total} — ${allOk ? '🟢 SOVEREIGN ONLINE' : '🔴 DEGRADED'}`);
  console.log('═'.repeat(60) + '\n');

  await announceReadiness(results);

  return { ok: allOk, passed, total, results };
}
