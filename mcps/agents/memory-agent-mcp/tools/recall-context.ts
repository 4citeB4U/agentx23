// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/tools/recall-context.ts
// Purpose: 3-layer memory recall — session → InsForge cache → NotebookLM deep
// =============================================================================
import { env } from "../../shared/env.js";
import { sessionStore } from "../lib/session-store.js";

export async function recallContext(args: Record<string, unknown>): Promise<{
  summary: string;
  key_facts: string[];
  episode_ids: string[];
  layer: "session" | "insforge" | "notebooklm" | "empty";
}> {
  const utterance = String(args["utterance"] ?? "");
  const sessionId = String(args["session_id"] ?? "default");

  // ─── Layer 1: Session (in-memory, instant) ────────────────────────────────
  const sessionHits = sessionStore.search(sessionId, utterance);
  if (sessionHits.length > 0) {
    return {
      summary: sessionHits.map((h) => h.content).join("\n"),
      key_facts: sessionHits.map(
        (h) => `[${h.role}] ${h.content.slice(0, 80)}`,
      ),
      episode_ids: sessionHits.map((h) => h.id),
      layer: "session",
    };
  }

  // ─── Layer 2: InsForge Postgres cache (recent missions, last 7 days) ──────
  const insforgeBase = env("INSFORGE_API_BASE_URL", "");
  const insforgeToken = env("INSFORGE_TOKEN", "");
  if (insforgeBase && insforgeToken) {
    try {
      const since = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const res = await fetch(
        `${insforgeBase}/rest/v1/agent_episodes?select=id,content,role,created_at&created_at=gte.${since}&content=ilike.*${encodeURIComponent(utterance.slice(0, 40))}*&limit=10`,
        {
          headers: {
            apikey: insforgeToken,
            Authorization: `Bearer ${insforgeToken}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          id: string;
          content: string;
          role: string;
          created_at: string;
        }>;
        if (rows.length > 0) {
          return {
            summary: rows.map((r) => `[${r.role}] ${r.content}`).join("\n"),
            key_facts: rows.map((r) => `${r.id}: ${r.content.slice(0, 80)}`),
            episode_ids: rows.map((r) => r.id),
            layer: "insforge",
          };
        }
      } else {
        console.warn(
          `[MemoryAgent] InsForge cache query returned ${res.status}`,
        );
      }
    } catch (err: any) {
      console.warn(`[MemoryAgent] InsForge cache unreachable: ${err.message}`);
    }
  }

  // ─── Layer 3: NotebookLM deep recall (grounded canonical knowledge) ───────
  const notebookId = env("NOTEBOOKLM_NOTEBOOK_ID", "");
  const apiKey =
    env("NOTEBOOKLM_GOOGLE_API_KEY", "") || env("GEMINI_API_KEY", "");

  if (!notebookId || !apiKey) {
    return { summary: "", key_facts: [], episode_ids: [], layer: "empty" };
  }

  try {
    const res = await fetch(
      `https://notebooklm.googleapis.com/v1beta/notebooks/${notebookId}:query?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: utterance }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) {
      console.warn(`[MemoryAgent] NotebookLM query failed: ${res.status}`);
      return { summary: "", key_facts: [], episode_ids: [], layer: "empty" };
    }
    const data = (await res.json()) as {
      answer?: string;
      sources?: Array<{ title?: string }>;
    };
    return {
      summary: data.answer ?? "",
      key_facts: [],
      episode_ids: (data.sources ?? [])
        .map((s) => s.title ?? "")
        .filter(Boolean),
      layer: "notebooklm",
    };
  } catch (err) {
    console.error("[MemoryAgent] recallContext notebooklm error:", err);
    return { summary: "", key_facts: [], episode_ids: [], layer: "empty" };
  }
}
