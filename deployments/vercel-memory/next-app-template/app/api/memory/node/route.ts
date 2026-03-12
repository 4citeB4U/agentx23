// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/app/api/memory/node/route.ts
// Purpose: Canonical node write endpoint for Vercel Memory Lake graph
// Security: LEEWAY-CORE-2026 compliant
// Performance: Insert-only graph node ingestion with minimal validation

// @ts-ignore template dependency resolved in target Next.js app
import { sql } from "@vercel/postgres";
// @ts-ignore template dependency resolved in target Next.js app
import { NextResponse } from "next/server";
import { requireMemoryAuth } from "../../../../lib/memory-auth";

export async function POST(req: Request) {
  const denied = requireMemoryAuth(req);
  if (denied) return denied;

  const body = await req.json();
  const { type, title, summary, tags, metadata } = body || {};

  if (!type || typeof type !== "string") {
    return NextResponse.json(
      { ok: false, error: "type is required" },
      { status: 400 },
    );
  }

  const result = await sql`
    INSERT INTO nodes (type, title, summary, tags, metadata)
    VALUES (
      ${type},
      ${title || null},
      ${summary || null},
      ${Array.isArray(tags) ? tags : []},
      ${metadata || {}}
    )
    RETURNING node_id
  `;

  return NextResponse.json({ ok: true, node_id: result.rows[0].node_id });
}
