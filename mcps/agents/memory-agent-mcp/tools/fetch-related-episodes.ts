// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/tools/fetch-related-episodes.ts
// =============================================================================
import type { MissionSummary } from "../../../contracts/agent-contracts.js";
import { env } from "../../shared/env.js";

export async function fetchRelatedEpisodes(
  args: Record<string, unknown>,
): Promise<MissionSummary[]> {
  const utterance = String(args["utterance"] ?? "");
  const topK = Number(args["top_k"] ?? 3);
  const baseUrl = env("CANONICAL_MEMORY_BASE_URL", "");
  const apiKey = env("CANONICAL_MEMORY_API_KEY", "");

  if (!baseUrl || !apiKey) return [];

  try {
    const url = new URL(`${baseUrl}/api/missions/search`);
    url.searchParams.set("q", utterance);
    url.searchParams.set("limit", String(topK));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    return (await res.json()) as MissionSummary[];
  } catch {
    return [];
  }
}
