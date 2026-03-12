<!-- LEEWAY HEADER BLOCK -->
<!-- File: deployments/vercel-memory/api-routes.md -->
<!-- Purpose: App Router route templates for Vercel canonical memory API -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Lightweight SQL gateway routes for canonical memory -->

# Vercel Memory API Route Templates

Use these in a Next.js App Router project with `@vercel/postgres`.

## Required auth helper

Create `lib/memory-auth.ts` and call `requireMemoryAuth(req)` at the top of each route.

```ts
import { NextResponse } from "next/server";

const WINDOW_MS = Number(process.env.MEMORY_API_WINDOW_MS || 5 * 60 * 1000);
const nonces = new Map<string, number>();

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function requireMemoryAuth(req: Request): NextResponse | null {
  const expected = process.env.CANONICAL_MEMORY_API_KEY || "";
  const provided =
    req.headers.get("x-memory-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!expected || !provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const now = Date.now();
  const tsRaw = req.headers.get("x-memory-ts");
  if (tsRaw) {
    const ts = Number(tsRaw);
    if (Number.isNaN(ts) || Math.abs(now - ts) > WINDOW_MS) {
      return NextResponse.json(
        { ok: false, error: "STALE_REQUEST" },
        { status: 408 },
      );
    }
  }

  const nonce = req.headers.get("x-memory-nonce");
  if (nonce) {
    if (nonces.has(nonce)) {
      return NextResponse.json(
        { ok: false, error: "REPLAY_DETECTED" },
        { status: 409 },
      );
    }
    nonces.set(nonce, now);
  }

  return null;
}
```

## `app/api/memory/episode/route.ts`

```ts
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
  } = body;

  const result = await sql`
    INSERT INTO episodes (
      episode_id, intent, analysis, plan, final_answer,
      confidence, reward, source, domain, adapter, execution_mode, created_at
    ) VALUES (
      COALESCE(${episode_id}, uuid_generate_v4()),
      ${intent}, ${analysis}, ${plan}, ${final_answer},
      ${confidence}, ${reward}, ${source}, ${domain}, ${adapter}, ${execution_mode},
      COALESCE(${created_at}, NOW())
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
```

## `app/api/memory/node/route.ts`

```ts
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { type, title, summary, tags, metadata } = await req.json();
  const result = await sql`
    INSERT INTO nodes (type, title, summary, tags, metadata)
    VALUES (${type}, ${title}, ${summary}, ${tags}, ${metadata})
    RETURNING node_id
  `;
  return NextResponse.json({ ok: true, node_id: result.rows[0].node_id });
}
```

## `app/api/memory/query/route.ts`

```ts
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag") || "agentlee";
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
```

## `app/api/memory/mission/route.ts`

```ts
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { goal, context, status, priority, created_at } = await req.json();
  const result = await sql`
    INSERT INTO missions (goal, context, status, priority, created_at)
    VALUES (${goal}, ${context}, COALESCE(${status}, 'pending'), COALESCE(${priority}, 1), COALESCE(${created_at}, NOW()))
    RETURNING mission_id
  `;
  return NextResponse.json({ ok: true, mission_id: result.rows[0].mission_id });
}
```

## `app/api/memory/synthetic/route.ts`

```ts
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const {
    episode_id,
    prompt,
    response,
    reward,
    variant_type,
    metadata,
    created_at,
  } = await req.json();
  const result = await sql`
    INSERT INTO synthetic_corpus (
      episode_id, prompt, response, reward, variant_type, metadata, created_at
    ) VALUES (
      NULLIF(${episode_id}, '')::uuid,
      ${prompt}, ${response}, ${reward}, ${variant_type}, ${metadata}, COALESCE(${created_at}, NOW())
    )
    RETURNING sample_id
  `;
  return NextResponse.json({ ok: true, sample_id: result.rows[0].sample_id });
}
```

## `app/api/memory/adapter/route.ts`

```ts
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { domain, path, enabled, performance_score, metadata, last_updated } =
    await req.json();
  const result = await sql`
    INSERT INTO adapters (domain, path, enabled, performance_score, metadata, last_updated)
    VALUES (${domain}, ${path}, COALESCE(${enabled}, true), ${performance_score}, ${metadata}, COALESCE(${last_updated}, NOW()))
    RETURNING adapter_id
  `;
  return NextResponse.json({ ok: true, adapter_id: result.rows[0].adapter_id });
}
```
