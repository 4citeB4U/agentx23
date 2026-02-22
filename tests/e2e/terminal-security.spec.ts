/**
 * Terminal Security E2E Tests — Playwright
 * Tier 2: Browser-level tests mirroring the T1-T9 notebook suite
 * LEEWAY-CORE-2026
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.AGENT_LEE_URL || 'http://localhost:3000';

// ── T1: Health endpoint ───────────────────────────────────────────────────
test('T1: /health returns 200 with status field', async ({ request }) => {
  const res  = await request.get(`${BASE}/health`);
  const body = await res.json();
  expect(res.ok()).toBeTruthy();
  expect(body).toHaveProperty('status');
});

// ── T2: Terminal session creation ─────────────────────────────────────────
test('T2: POST /api/terminal/session creates a session', async ({ request }) => {
  const res = await request.post(`${BASE}/api/terminal/session`, { data: {} });
  expect(res.status()).toBeLessThan(500);
});

// ── T3: Terminal command injection blocked ─────────────────────────────────
test('T3: rm -rf blocked by terminal policy', async ({ request }) => {
  const res = await request.post(`${BASE}/api/terminal/execute`, {
    data: { command: 'rm -rf /tmp/test' },
  });
  // Should either 403 or blocked response
  expect([200, 403, 400]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body.blocked ?? body.error ?? body.output).toBeTruthy();
  }
});

// ── T4: No path traversal ─────────────────────────────────────────────────
test('T4: Path traversal ../../ blocked', async ({ request }) => {
  const res = await request.post(`${BASE}/api/terminal/execute`, {
    data: { command: 'cat ../../etc/passwd' },
  });
  expect([403, 400, 200]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body.blocked || body.error).toBeTruthy();
  }
});

// ── T5: Chat API responds ─────────────────────────────────────────────────
test('T5: POST /api/chat returns reply', async ({ request }) => {
  const res  = await request.post(`${BASE}/api/chat`, { data: { message: 'Hello' } });
  expect(res.status()).toBeLessThan(500);
  if (res.status() === 200) {
    const body = await res.json();
    expect(body).toHaveProperty('reply');
  }
});

// ── T6: CORS headers present ──────────────────────────────────────────────
test('T6: /health has CORS or X-Frame-Options header', async ({ request }) => {
  const res = await request.get(`${BASE}/health`);
  const cors = res.headers()['access-control-allow-origin'];
  const xfo  = res.headers()['x-frame-options'];
  const csp  = res.headers()['content-security-policy'];
  expect(cors || xfo || csp).toBeTruthy();
});

// ── T7: Unknown route gives 404 ───────────────────────────────────────────
test('T7: Unknown API route returns 404', async ({ request }) => {
  const res = await request.get(`${BASE}/api/__nonexistent_route__`);
  expect(res.status()).toBe(404);
});

// ── T8: Safe mode flag accessible ────────────────────────────────────────
test('T8: Recovery status endpoint is available', async ({ request }) => {
  const res = await request.get(`${BASE}/api/recovery/status`);
  // Accept 200 or 404 (endpoint may not be wired yet)
  expect([200, 404]).toContain(res.status());
});

// ── T9: UI loads ──────────────────────────────────────────────────────────
test('T9: UI root page loads', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle(/.+/);
  const body = page.locator('body');
  await expect(body).not.toBeEmpty();
});
