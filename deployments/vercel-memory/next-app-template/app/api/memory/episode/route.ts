// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/app/api/memory/episode/route.ts
// Purpose: Canonical episode write endpoint for Vercel Memory Lake
// Security: LEEWAY-CORE-2026 compliant
// Performance: Upsert by episode_id with compact payload validation

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
    intent,
    analysis,
    plan,
    final_answer,
    confidence,
    reward,
    source,
    domain,
    adapter,
    execution_mode,
    created_at,
  } = body || {};

  const result = await sql`
    INSERT INTO episodes (
      episode_id, intent, analysis, plan, final_answer,
      confidence, reward, source, domain, adapter, execution_mode, created_at
    ) VALUES (
      COALESCE(NULLIF(${episode_id}, '')::uuid, uuid_generate_v4()),
      ${intent || ""}, ${analysis || ""}, ${plan || []}, ${final_answer || ""},
      ${Number(confidence || 0)}, ${Number(reward || 0)}, ${source || "brain_router"},
      ${domain || "general"}, ${adapter || "qwen_general_adapter"}, ${execution_mode || "single_pass"},
      COALESCE(${created_at || null}, NOW())
    )
    ON CONFLICT (episode_id) DO UPDATE SET
      intent = EXCLUDED.intent,
      analysis = EXCLUDED.analysis,
      plan = EXCLUDED.plan,
      final_answer = EXCLUDED.final_answer,
      confidence = EXCLUDED.confidence,
      reward = EXCLUDED.reward,
      source = EXCLUDED.source,
      domain = EXCLUDED.domain,
      adapter = EXCLUDED.adapter,
      execution_mode = EXCLUDED.execution_mode
    RETURNING episode_id
  `;

  return NextResponse.json({ ok: true, episode_id: result.rows[0].episode_id });
}
