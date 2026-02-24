/**
 * test_api.js — Agent Lee OS API smoke tests
 * Run: node scripts/test_api.js
 */

const BASE = 'http://127.0.0.1:8001';
const HANDSHAKE = 'AGENT_LEE_SOVEREIGN_V1';
const H = { 'Content-Type': 'application/json', 'x-neural-handshake': HANDSHAKE };

let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

async function run() {
  console.log('─────────────────────────────────────');
  console.log('  AGENT LEE OS — API Test Suite');
  console.log('─────────────────────────────────────\n');

  // ── 1. POST /api/chat ──────────────────────────────────────────────────────
  await test('POST /api/chat → 2xx + text field', async () => {
    const uid = `api-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: H, body: JSON.stringify({ text: `status check ${uid}`, id: uid }) });
    assert(r.status >= 200 && r.status < 300, `Expected 2xx, got ${r.status}`);
    const d = await r.json().catch(() => null);
    assert(d !== null, 'Response body is not valid JSON');
    // accepted = has text; ignored = dedup (also valid)
    const hasText = typeof d.text === 'string' && d.text.length > 0;
    const isIgnored = d.status === 'ignored';
    assert(hasText || isIgnored, `Unexpected response: ${JSON.stringify(d).slice(0, 100)}`);
  });

  // ── Persona Drift Detection ───────────────────────────────────────────────
  await test('POST /api/chat → persona marker present in response', async () => {
    const uid = `persona-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: H, body: JSON.stringify({ text: `introduce yourself ${uid}`, id: uid }) });
    assert(r.status >= 200 && r.status < 300, `Expected 2xx, got ${r.status}`);
    const d = await r.json().catch(() => null);
    assert(d && typeof d.text === 'string', 'No text response');
    const personaMarkers = [
      'Yo',
      'Agent Lee',
      'sovereign',
      'Real talk',
      'living cognitive architecture',
      'voice-first',
      'The Night Architect',
      'I am not a chatbot',
      'Sovereign Intelligence Operating System'
    ];
    const found = personaMarkers.some(m => d.text.includes(m));
    assert(found, `Persona marker not found in response: ${d.text.slice(0, 120)}`);
  });

  await new Promise(r => setTimeout(r, 800)); // avoid dedup window

  await test('POST /api/chat → in-character response (not raw error)', async () => {
    const uid2 = `api-test2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: H, body: JSON.stringify({ text: `yo what is good ${uid2}`, id: uid2 }) });
    const d = await r.json().catch(() => null);
    const text = d?.text || d?.reason || '';
    assert(!text.includes('Unexpected token'), `Got raw JSON parse error: ${text.slice(0, 80)}`);
    assert(!text.startsWith('ERROR: Neural disruption. (Unexpected token'), `Got raw crash error: ${text.slice(0, 80)}`);
  });

  await test('POST /api/chat → 401 without handshake', async () => {
    const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'test', id: `no-auth-${Date.now()}` }) });
    assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // ── 2. GET /api/services/system-status ────────────────────────────────────
  await test('GET /api/services/system-status → 200 + auth block', async () => {
    const r = await fetch(`${BASE}/api/services/system-status`, { headers: H });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const d = await r.json();
    assert(d.auth !== undefined, 'auth block missing');
    assert(typeof d.auth.valid === 'boolean', 'auth.valid not boolean');
  });

  await test('GET /api/services/system-status → auth.valid is true', async () => {
    const r = await fetch(`${BASE}/api/services/system-status`, { headers: H });
    const d = await r.json();
    assert(d.auth.valid === true, `auth.valid = ${d.auth.valid}`);
  });

  // ── 3. TTS endpoint ───────────────────────────────────────────────────────
  await test('POST /api/chat/tts → audio response (200)', async () => {
    const r = await fetch(`${BASE}/api/chat/tts`, { method: 'POST', headers: H, body: JSON.stringify({ text: 'Yo, test.' }) });
    // 200 with audio = good; 404/501 = TTS not wired on backend yet
    if (r.status === 404 || r.status === 501) {
      throw new Error(`TTS route not found (${r.status}) — wire /api/chat/tts in chat.ts`);
    }
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    assert(ct.includes('audio') || ct.includes('octet-stream'), `Expected audio content-type, got ${ct}`);
  });

  // ── 4. Screenshot / Live View ─────────────────────────────────────────────
  await test('GET /api/device/screenshot → 200 + image/jpeg', async () => {
    const r = await fetch(`${BASE}/api/device/screenshot`, { headers: H });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    assert(ct.includes('image/jpeg'), `Expected image/jpeg, got ${ct}`);
    const buf = await r.arrayBuffer();
    assert(buf.byteLength > 5000, `Image too small: ${buf.byteLength} bytes`);
  });

  // ── 5. Tunnel status ──────────────────────────────────────────────────────
  await test('GET /api/tunnel/status → 200 + status field', async () => {
    const r = await fetch(`${BASE}/api/tunnel/status`, { headers: H });
    if (r.status === 404) throw new Error('Route /api/tunnel/status not found');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const d = await r.json();
    assert(d.status !== undefined || d.running !== undefined, 'No status/running field in response');
  });

  // ── 6. Static frontend served ─────────────────────────────────────────────
  await test('GET / → serves HTML frontend (200)', async () => {
    const r = await fetch(`${BASE}/`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const html = await r.text();
    assert(html.includes('<html') || html.includes('<!DOCTYPE'), 'Response is not HTML');
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(`─────────────────────────────────────`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
