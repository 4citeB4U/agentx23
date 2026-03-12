// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/tools/build-context-packet.ts
// =============================================================================
import type {
    ContextPacket,
    IntentClass,
    Platform,
} from "../../../contracts/agent-contracts.js";
import { recallContext } from "./recall-context.js";

export async function buildContextPacket(
  args: Record<string, unknown>,
): Promise<ContextPacket> {
  const session_id = String(args["session_id"] ?? "unknown");
  const user_id = String(args["user_id"] ?? "user");
  const intent = String(args["intent"] ?? "converse") as IntentClass;
  const utterance = String(args["utterance"] ?? "");
  const platform = String(args["platform"] ?? "cloudflare") as Platform;

  const memory_snapshot = await recallContext({
    session_id,
    utterance,
    intent,
  });

  return {
    session_id,
    user_id,
    platform,
    intent,
    utterance,
    plan: [],
    memory_snapshot: memory_snapshot.summary ? memory_snapshot : null,
    tool_outputs: [],
    policy_flags: [],
    timestamp: new Date().toISOString(),
    model_lane_override: null,
  };
}
