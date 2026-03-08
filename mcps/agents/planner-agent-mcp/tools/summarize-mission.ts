// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/planner-agent-mcp/tools/summarize-mission.ts
// =============================================================================
import { randomUUID } from "crypto";
import type {
    ContextPacket,
    MissionStatus,
    MissionSummary,
    ModelLane,
    ToolOutput,
} from "../../../contracts/agent-contracts.js";

export async function summarizeMission(
  args: Record<string, unknown>,
): Promise<MissionSummary> {
  const context = args["context"] as ContextPacket;
  const toolOutputs = (args["tool_outputs"] as ToolOutput[]) ?? [];
  const status = String(args["status"] ?? "completed") as MissionStatus;
  const durationMs = Number(args["duration_ms"] ?? 0);

  return {
    mission_id: randomUUID(),
    session_id: context.session_id,
    original_utterance: context.utterance,
    intent: context.intent,
    plan_executed: context.plan,
    agents_involved: [...new Set(toolOutputs.map((t) => t.tool.split(".")[0]))],
    tools_used: toolOutputs.map((t) => t.tool),
    outcome_summary: `Mission "${context.intent}" completed in ${durationMs}ms with ${toolOutputs.length} tool calls.`,
    artifacts: [],
    status,
    error: null,
    duration_ms: durationMs,
    model_lane_used: (context.model_lane_override ?? "glm_flash") as ModelLane,
    timestamp: new Date().toISOString(),
    key_learnings: [],
  };
}
