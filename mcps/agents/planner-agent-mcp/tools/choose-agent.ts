// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/planner-agent-mcp/tools/choose-agent.ts
// =============================================================================
import type { IntentClass } from "../../../contracts/agent-contracts.js";
import { INTENT_ROUTER_MAP } from "../../../contracts/intent-router-map.js";

export async function chooseAgent(
  args: Record<string, unknown>,
): Promise<{ agent: string; model_lane: string; fallbacks: string[] }> {
  const intent = String(args["intent"] ?? "") as IntentClass;
  const route = INTENT_ROUTER_MAP[intent];
  if (!route) {
    return { agent: "agent-lee-core", model_lane: "gemini", fallbacks: [] };
  }
  return {
    agent: route.primary_agent,
    model_lane: route.model_lane,
    fallbacks: route.fallback_agents ?? [],
  };
}
