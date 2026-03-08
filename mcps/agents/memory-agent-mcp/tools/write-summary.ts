// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/tools/write-summary.ts
// =============================================================================
import { appendFile } from "fs/promises";
import type { MissionSummary } from "../../../contracts/agent-contracts.js";
import { env } from "../../shared/env.js";

const CACHE_PATH = "data/memory_cache.jsonl";

export async function writeSummary(
  args: Record<string, unknown>,
): Promise<{ stored: boolean; location: string }> {
  const summary = args["summary"] as MissionSummary;
  const baseUrl = env("CANONICAL_MEMORY_BASE_URL", "");
  const apiKey = env("CANONICAL_MEMORY_API_KEY", "");

  if (baseUrl && apiKey) {
    try {
      const res = await fetch(`${baseUrl}/api/missions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(summary),
      });
      if (res.ok) return { stored: true, location: "vercel" };
      console.warn(`[MemoryAgent] Vercel write failed: ${res.status}`);
    } catch (err) {
      console.error("[MemoryAgent] writeSummary remote error:", err);
    }
  }

  // Local fallback
  await appendFile(CACHE_PATH, JSON.stringify(summary) + "\n", "utf-8");
  return { stored: true, location: "local_cache" };
}
