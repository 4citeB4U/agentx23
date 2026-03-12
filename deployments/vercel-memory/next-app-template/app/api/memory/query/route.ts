// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/app/api/memory/query/route.ts
// Purpose: Canonical node query endpoint for memory recall by tag
// Security: LEEWAY-CORE-2026 compliant
// Performance: Indexed tag search with bounded limit and recency ordering

// @ts-ignore template dependency resolved in target Next.js app
import { sql } from "@vercel/postgres";
// @ts-ignore template dependency resolved in target Next.js app
import { NextResponse } from "next/server";
import { requireMemoryAuth } from "../../../../lib/memory-auth";

export async function GET(req: Request) {
  const denied = requireMemoryAuth(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const tag = (searchParams.get("tag") || "agentlee").slice(0, 64);
  const limit = Math.min(Number(searchParams.get("limit") || 25), 100);

  const result = await sql`
    SELECT *
    FROM nodes
    WHERE ${tag} = ANY(tags)
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(result.rows);
}
