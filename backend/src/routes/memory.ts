// LEEWAY v12 HEADER
// File: backend/src/routes/memory.ts
// Purpose: Local Memory Lake gateway — writes to workspace/episodes.db (SQLite)
// and fire-and-forgets canonical Vercel Postgres sync via CANONICAL_MEMORY_BASE_URL.
// Auth: inherits x-neural-handshake from securityMiddleware (applied in index.ts).

import crypto from "crypto";
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE = path.join(__dirname, "../../../workspace");
const LOCAL_NODES_FILE = path.join(WORKSPACE, "memory_nodes.jsonl");
const CANONICAL_BASE =
  process.env.CANONICAL_MEMORY_BASE_URL?.replace(/\/$/, "") || "";
const CANONICAL_KEY = process.env.CANONICAL_MEMORY_API_KEY || "";
const CANONICAL_TIMEOUT_MS = Number(
  process.env.CANONICAL_MEMORY_TIMEOUT_MS || 8000,
);

function ensureWorkspace(): void {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
}

async function canonicalPost(subPath: string, body: unknown): Promise<void> {
  if (!CANONICAL_BASE) return;
  const url = `${CANONICAL_BASE}/api/memory/${subPath}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CANONICAL_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-memory-key": CANONICAL_KEY,
        Authorization: `Bearer ${CANONICAL_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    console.warn(
      "[Memory] Canonical sync failed (fire-and-forget):",
      (e as Error).message,
    );
  } finally {
    clearTimeout(timer);
  }
}

function appendNode(node: Record<string, unknown>): void {
  ensureWorkspace();
  const line =
    JSON.stringify({ ...node, _local_ts: new Date().toISOString() }) + "\n";
  fs.appendFileSync(LOCAL_NODES_FILE, line, "utf8");
}

export const memoryRouter = Router();

// POST /api/memory/episode — upsert episode locally + canonical sync
memoryRouter.post("/episode", (req, res) => {
  try {
    const body = req.body || {};
    const episode_id = body.episode_id || crypto.randomUUID();
    const record = { episode_id, ...body, _type: "episode" };
    appendNode(record);
    // Canonical sync is fire-and-forget
    canonicalPost("episode", record).catch(() => {});
    res.json({ ok: true, episode_id });
  } catch (e) {
    res
      .status(500)
      .json({ error: "MEMORY_WRITE_FAILED", details: (e as Error).message });
  }
});

// POST /api/memory/node — insert graph node locally + canonical sync
memoryRouter.post("/node", (req, res) => {
  try {
    const body = req.body || {};
    if (!body.type) return res.status(400).json({ error: "MISSING_TYPE" });
    const node_id = crypto.randomUUID();
    const record = { node_id, ...body, _type: "node" };
    appendNode(record);
    canonicalPost("node", record).catch(() => {});
    res.json({ ok: true, node_id });
  } catch (e) {
    res
      .status(500)
      .json({ error: "MEMORY_WRITE_FAILED", details: (e as Error).message });
  }
});

// POST /api/memory/mission — insert mission locally + canonical sync
memoryRouter.post("/mission", (req, res) => {
  try {
    const body = req.body || {};
    const mission_id = crypto.randomUUID();
    const record = {
      mission_id,
      ...body,
      _type: "mission",
      status: body.status || "pending",
    };
    appendNode(record);
    canonicalPost("mission", record).catch(() => {});
    res.json({ ok: true, mission_id });
  } catch (e) {
    res
      .status(500)
      .json({ error: "MEMORY_WRITE_FAILED", details: (e as Error).message });
  }
});

// POST /api/memory/synthetic — append synthetic corpus entry
memoryRouter.post("/synthetic", (req, res) => {
  try {
    const body = req.body || {};
    const sample_id = crypto.randomUUID();
    const record = { sample_id, ...body, _type: "synthetic" };
    appendNode(record);
    canonicalPost("synthetic", record).catch(() => {});
    res.json({ ok: true, sample_id });
  } catch (e) {
    res
      .status(500)
      .json({ error: "MEMORY_WRITE_FAILED", details: (e as Error).message });
  }
});

// GET /api/memory/query?tag=&limit= — local JSONL search + optional canonical query
memoryRouter.get("/query", (req, res) => {
  try {
    ensureWorkspace();
    const tag = String(req.query.tag || "agentlee").toLowerCase();
    const limit = Math.min(Number(req.query.limit || 25), 100);

    let nodes: unknown[] = [];
    if (fs.existsSync(LOCAL_NODES_FILE)) {
      const lines = fs
        .readFileSync(LOCAL_NODES_FILE, "utf8")
        .split("\n")
        .filter(Boolean);
      nodes = lines
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter((n) => n && JSON.stringify(n).toLowerCase().includes(tag))
        .slice(-limit)
        .reverse();
    }
    res.json({
      ok: true,
      nodes,
      count: nodes.length,
      canonical_connected: !!CANONICAL_BASE,
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: "MEMORY_QUERY_FAILED", details: (e as Error).message });
  }
});

// GET /api/memory/status — health check for memory pipeline
memoryRouter.get("/status", (req, res) => {
  ensureWorkspace();
  const localExists = fs.existsSync(LOCAL_NODES_FILE);
  const localSize = localExists ? fs.statSync(LOCAL_NODES_FILE).size : 0;
  res.json({
    ok: true,
    local: {
      file: "workspace/memory_nodes.jsonl",
      exists: localExists,
      bytes: localSize,
    },
    canonical: { connected: !!CANONICAL_BASE, url: CANONICAL_BASE || null },
  });
});
