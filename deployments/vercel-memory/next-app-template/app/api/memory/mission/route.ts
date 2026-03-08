// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/app/api/memory/mission/route.ts
// Purpose: Canonical mission queue write endpoint for Memory Lake
// Security: LEEWAY-CORE-2026 compliant
// Performance: Priority-aware mission ingestion with timestamp defaults

// @ts-ignore template dependency resolved in target Next.js app
import { sql } from "@vercel/postgres";
// @ts-ignore template dependency resolved in target Next.js app
import { NextResponse } from "next/server";
import { requireMemoryAuth } from "../../../../lib/memory-auth";

export async function POST(req: Request) {
  const denied = requireMemoryAuth(req);
  if (denied) return denied;

  const body = await req.json();
  const { goal, context, status, priority, created_at, completed_at } =
    body || {};

  const result = await sql`
    INSERT INTO missions (
      goal, context, status, priority, created_at, completed_at
    ) VALUES (
      ${goal || "mission"},
      ${context || {}},
      ${status || "pending"},
      ${Number(priority || 1)},
      COALESCE(${created_at || null}, NOW()),
      ${completed_at || null}
    )
    RETURNING mission_id
  `;

  return NextResponse.json({ ok: true, mission_id: result.rows[0].mission_id });
}
