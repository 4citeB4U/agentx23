<!-- LEEWAY HEADER BLOCK -->
<!-- File: deployments/vercel-memory/next-app-template/README.md -->
<!-- Purpose: Installation guide for secure Next.js canonical memory route template -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Minimal setup for production-safe Vercel memory API -->

# Next.js Template — Canonical Memory API

This folder contains ready-to-drop App Router files for:

- `POST /api/memory/episode`
- `POST /api/memory/node`
- `GET /api/memory/query`
- `POST /api/memory/mission`
- `POST /api/memory/synthetic`
- `POST /api/memory/adapter`

## Setup

1. Copy `app/api/memory/*` into your Next.js project.
2. Copy `lib/memory-auth.ts` into your project `lib/` folder.
3. Set env vars in Vercel project settings:

```bash
CANONICAL_MEMORY_API_KEY=<strong-random-key>
MEMORY_API_WINDOW_MS=300000
MEMORY_API_NONCE_CACHE=5000
```

4. Apply schema from `deployments/vercel-memory/schema.sql`.

## Auth contract

Accepted headers:

- `x-memory-key: <CANONICAL_MEMORY_API_KEY>` or `Authorization: Bearer <key>`
- Optional replay protection:
  - `x-memory-ts: <unix-ms>`
  - `x-memory-nonce: <uuid-or-random>`

## Operational note

If you want strict replay protection, send both `x-memory-ts` and `x-memory-nonce` from the Mini PC router on every write.
