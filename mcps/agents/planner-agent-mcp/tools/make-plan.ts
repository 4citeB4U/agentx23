// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/planner-agent-mcp/tools/make-plan.ts
// =============================================================================
import type { ContextPacket } from "../../../contracts/agent-contracts.js";
import { INTENT_ROUTER_MAP } from "../../../contracts/intent-router-map.js";

export interface PlanStep {
  step: number;
  description: string;
  agent: string;
  model_lane: string;
  depends_on?: number[];
}

export async function makePlan(
  args: Record<string, unknown>,
): Promise<PlanStep[]> {
  const context = args["context"] as ContextPacket | undefined;
  if (!context) return [];

  const route = INTENT_ROUTER_MAP[context.intent];
  // Base plan: always start with a primary agent step
  const steps: PlanStep[] = [
    {
      step: 1,
      description: `Handle intent "${context.intent}": ${context.utterance.slice(0, 80)}`,
      agent: route.primary_agent,
      model_lane: route.model_lane,
    },
  ];

  // If memory recall is not the primary intent, prepend a memory check
  if (context.intent !== "recall_memory" && context.intent !== "write_memory") {
    steps.unshift({
      step: 0,
      description: "Retrieve relevant memory context",
      agent: "memory-agent-mcp",
      model_lane: "notebooklm",
    });
    steps[1].depends_on = [0];
  }

  // Always end with mission summary
  steps.push({
    step: steps.length,
    description: "Summarize mission outcome and write to memory",
    agent: "planner-agent-mcp",
    model_lane: "glm_flash",
    depends_on: [steps.length - 1],
  });

  return steps;
}
