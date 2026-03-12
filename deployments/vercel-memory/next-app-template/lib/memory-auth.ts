// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/lib/memory-auth.ts
// Purpose: Shared authorization and replay-protection checks for canonical memory routes
// Security: LEEWAY-CORE-2026 compliant
// Performance: Constant-time key compare with lightweight request guards

// @ts-ignore template dependency resolved in target Next.js app
import { NextResponse } from "next/server";

const WINDOW_MS = Number(process.env.MEMORY_API_WINDOW_MS || 5 * 60 * 1000);
const NONCE_MAX = Number(process.env.MEMORY_API_NONCE_CACHE || 5000);
const nonces = new Map<string, number>();

function pruneNonces(now: number) {
  for (const [nonce, ts] of nonces) {
    if (now - ts > WINDOW_MS) nonces.delete(nonce);
  }
  while (nonces.size > NONCE_MAX) {
    const firstKey = nonces.keys().next().value;
    if (!firstKey) break;
    nonces.delete(firstKey);
  }
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function unauthorized(detail: string) {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", detail },
    { status: 401 },
  );
}

function stale(detail: string) {
  return NextResponse.json(
    { ok: false, error: "STALE_REQUEST", detail },
    { status: 408 },
  );
}

function conflict(detail: string) {
  return NextResponse.json(
    { ok: false, error: "REPLAY_DETECTED", detail },
    { status: 409 },
  );
}

export function requireMemoryAuth(req: Request): NextResponse | null {
  const expected =
    process.env.CANONICAL_MEMORY_API_KEY || process.env.MEMORY_API_KEY || "";
  if (!expected) {
    return unauthorized("Server missing CANONICAL_MEMORY_API_KEY");
  }

  const headerKey = req.headers.get("x-memory-key") || "";
  const bearer = (req.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const provided = headerKey || bearer;

  if (!provided || !safeEqual(provided, expected)) {
    return unauthorized("Invalid memory API key");
  }

  const now = Date.now();
  pruneNonces(now);

  const tsRaw = req.headers.get("x-memory-ts") || "";
  if (tsRaw) {
    const ts = Number(tsRaw);
    if (Number.isNaN(ts) || Math.abs(now - ts) > WINDOW_MS) {
      return stale("Timestamp outside allowed window");
    }
  }

  const nonce = req.headers.get("x-memory-nonce") || "";
  if (nonce) {
    if (nonces.has(nonce)) {
      return conflict("Nonce already used");
    }
    nonces.set(nonce, now);
  }

  return null;
}
