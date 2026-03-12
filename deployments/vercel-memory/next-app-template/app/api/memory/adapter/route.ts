// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/app/api/memory/adapter/route.ts
// Purpose: Canonical adapter registry endpoint for domain adapter state
// Security: LEEWAY-CORE-2026 compliant
// Performance: Upsert by (domain,path) semantics via write-through inserts

// @ts-ignore template dependency resolved in target Next.js app
import { sql } from "@vercel/postgres";
// @ts-ignore template dependency resolved in target Next.js app
import { NextResponse } from "next/server";
import { requireMemoryAuth } from "../../../../lib/memory-auth";

export async function POST(req: Request) {
  const denied = requireMemoryAuth(req);
  if (denied) return denied;

  const body = await req.json();
  const { domain, path, enabled, performance_score, metadata, last_updated } =
    body || {};

  if (!domain || typeof domain !== "string") {
    return NextResponse.json(
      { ok: false, error: "domain is required" },
      { status: 400 },
    );
  }

  const result = await sql`
    INSERT INTO adapters (
      domain, path, enabled, performance_score, metadata, last_updated
    ) VALUES (
      ${domain},
      ${path || ""},
      ${typeof enabled === "boolean" ? enabled : true},
      ${Number(performance_score || 0)},
      ${metadata || {}},
      COALESCE(${last_updated || null}, NOW())
    )
    RETURNING adapter_id
  `;

  return NextResponse.json({ ok: true, adapter_id: result.rows[0].adapter_id });
}
