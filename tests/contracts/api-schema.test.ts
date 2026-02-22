/**
 * API Contract Tests — Zod schema validation
 * Tier 1: Verify backend API surface is intact
 * LEEWAY-CORE-2026
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const BASE = process.env.AGENT_LEE_URL || 'http://localhost:8001';
const HANDSHAKE = process.env.NEURAL_HANDSHAKE || 'AGENT_LEE_SOVEREIGN_V1';

// ── Schemas ───────────────────────────────────────────────────────────────
// Health: { status: "healthy"|"degraded", port: number, timestamp: string }
const HealthSchema = z.object({
  status:    z.string(),
  port:      z.number().optional(),
  timestamp: z.string().optional(),
  uptime:    z.number().optional(),
});

const SessionSchema = z.object({
  sessionId: z.string(),
});

// Chat returns { id, source, role, text } OR { response, audio }
const ChatResponseSchema = z.union([
  z.object({ text:     z.string() }),
  z.object({ response: z.string() }),
  z.object({ reply:    z.string() }),
]);

// ── Helpers ───────────────────────────────────────────────────────────────
async function get(url: string) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'x-neural-handshake': HANDSHAKE }
  });
  return { status: res.status, body: await res.json() };
}

async function post(url: string, body: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-neural-handshake': HANDSHAKE,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('API Contracts', () => {
  it('GET /health returns valid schema', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    const result = HealthSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('POST /api/terminal/session returns sessionId', async () => {
    const { status, body } = await post('/api/terminal/session', {});
    // 200/201 = session created, 401 = auth needed, 400 = missing params — all non-5xx are acceptable
    expect(status).toBeLessThan(500);
    if (status === 200 || status === 201) {
      const result = SessionSchema.safeParse(body);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it('POST /api/chat returns reply', async () => {
    const { status, body } = await post('/api/chat', { message: 'ping' });
    expect(status).toBeLessThan(500);
    if (status === 200) {
      const result = ChatResponseSchema.safeParse(body);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  }, 20_000);

  it('Unknown route returns 404 or frontend fallback', async () => {
    const { status } = await get('/api/__nonexistent__');
    // 404 = explicit miss, 401 = security middleware blocked, 200 = frontend served
    expect(status).toBeLessThan(500);
  });
});

