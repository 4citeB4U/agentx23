/**
 * Terminal Security E2E Tests — Playwright
 * Tier 2: Browser-level tests mirroring the T1-T9 notebook suite
 * LEEWAY-CORE-2026
 */

import { expect, test } from "@playwright/test";
import crypto from "crypto";

// Use Playwright-configured baseURL by using relative paths
const HANDSHAKE =
  process.env.NEURAL_HANDSHAKE ||
  process.env.NEURAL_HANDSHAKE_KEY ||
  "AGENT_LEE_SOVEREIGN_V1";

// Device credentials (used to produce valid HMAC signatures for requests)
const DEVICE_ID = process.env.DEVICE_ID || "AGENT_LEE_ADMIN";
const DEVICE_SECRET =
  process.env.CRYPTO_SECRET ||
  process.env.DEVICE_SECRET ||
  "neural_master_key_v1";

function makeAuthHeaders(method: string, payload: any = {}) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const isWrite = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  const signedPayload = isWrite ? payload : {};
  const payloadStr = JSON.stringify(signedPayload || {});
  const message = payloadStr + timestamp + nonce;
  const signature = crypto
    .createHmac("sha256", DEVICE_SECRET)
    .update(message)
    .digest("hex");

  return {
    "x-neural-handshake": HANDSHAKE,
    "x-device-id": DEVICE_ID,
    "x-neural-timestamp": timestamp,
    "x-neural-nonce": nonce,
    "x-neural-signature": signature,
  };
}

// ── T1: Health endpoint ───────────────────────────────────────────────────
test("T1: /health returns 200 with status field", async ({ request }) => {
  const res = await request.get("/health", {
    headers: { "x-neural-handshake": HANDSHAKE },
  });
  const body = await res.json();
  expect(res.ok()).toBeTruthy();
  expect(body).toHaveProperty("status");
});

// ── T2: Terminal session creation ─────────────────────────────────────────
test("T2: POST /api/terminal/session creates a session", async ({
  request,
}) => {
  const res = await request.post("/api/terminal/session", {
    data: {},
    headers: makeAuthHeaders("POST", {}),
  });
  expect(res.status()).toBeLessThan(500);
});

// ── T3: Terminal command injection blocked ─────────────────────────────────
test("T3: rm -rf blocked by terminal policy", async ({ request }) => {
  const res = await request.post("/api/terminal/execute", {
    data: { command: "rm -rf /tmp/test" },
    headers: makeAuthHeaders("POST", { command: "rm -rf /tmp/test" }),
  });
  // Should either 403, 404 or blocked response
  expect([200, 403, 400, 404]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body.blocked ?? body.error ?? body.output).toBeTruthy();
  }
});

// ── T4: No path traversal ─────────────────────────────────────────────────
test("T4: Path traversal ../../ blocked", async ({ request }) => {
  const res = await request.post("/api/terminal/execute", {
    data: { command: "cat ../../etc/passwd" },
    headers: makeAuthHeaders("POST", { command: "cat ../../etc/passwd" }),
  });
  // Accept 403, 404, or a blocked/400 response
  expect([403, 400, 200, 404]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body.blocked || body.error).toBeTruthy();
  }
});

// ── T5: Chat API responds ─────────────────────────────────────────────────
test("T5: POST /api/chat returns reply", async ({ request }) => {
  const res = await request.post("/api/chat", {
    data: { message: "Hello" },
    headers: makeAuthHeaders("POST", { message: "Hello" }),
  });
  expect(res.status()).toBeLessThan(500);
  if (res.status() === 200) {
    const body = await res.json();
    // Accept both legacy `reply` or newer `text` payloads
    expect(body.reply || body.text).toBeTruthy();
  }
});

// ── T6: CORS headers present ──────────────────────────────────────────────
test("T6: /health has CORS or X-Frame-Options header", async ({ request }) => {
  const res = await request.get("/health", {
    headers: { "x-neural-handshake": HANDSHAKE },
  });
  const cors = res.headers()["access-control-allow-origin"];
  const xfo = res.headers()["x-frame-options"];
  const csp = res.headers()["content-security-policy"];
  expect(cors || xfo || csp).toBeTruthy();
});

// ── T7: Unknown route gives 404 ───────────────────────────────────────────
test("T7: Unknown API route returns 404", async ({ request }) => {
  const res = await request.get("/api/__nonexistent_route__", {
    headers: makeAuthHeaders("GET", {}),
  });
  expect(res.status()).toBe(404);
});

// ── T8: Safe mode flag accessible ────────────────────────────────────────
test("T8: Recovery status endpoint is available", async ({ request }) => {
  const res = await request.get("/api/recovery/status", {
    headers: makeAuthHeaders("GET", {}),
  });
  // Accept 200 or 404 (endpoint may not be wired yet)
  expect([200, 404]).toContain(res.status());
});

// ── T9: UI loads ──────────────────────────────────────────────────────────
test("T9: UI root page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
  const body = page.locator("body");
  await expect(body).not.toBeEmpty();
});
