// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/app/api/memory/synthetic/route.ts
// Purpose: Canonical synthetic corpus write endpoint for learning data
// Security: LEEWAY-CORE-2026 compliant
// Performance: High-volume append endpoint with bounded field handling

// @ts-ignore template dependency resolved in target Next.js app
import { sql } from "@vercel/postgres";
// @ts-ignore template dependency resolved in target Next.js app
import { NextResponse } from "next/server";
import { requireMemoryAuth } from "../../../../lib/memory-auth";

export async function POST(req: Request) {
  const denied = requireMemoryAuth(req);
  if (denied) return denied;

  const body = await req.json();
  const {
    episode_id,
    prompt,
    response,
    reward,
    variant_type,
    metadata,
    created_at,
  } = body || {};

  const result = await sql`
    INSERT INTO synthetic_corpus (
      episode_id, prompt, response, reward, variant_type, metadata, created_at
    ) VALUES (
      NULLIF(${episode_id || ""}, '')::uuid,
      ${prompt || ""},
      ${response || ""},
      ${Number(reward || 0)},
      ${variant_type || "synthetic"},
      ${metadata || {}},
      COALESCE(${created_at || null}, NOW())
    )
    RETURNING sample_id
  `;

  return NextResponse.json({ ok: true, sample_id: result.rows[0].sample_id });
}
