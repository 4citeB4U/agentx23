// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/planner-agent-mcp/tools/suggest-recovery.ts
// =============================================================================

export async function suggestRecovery(
  args: Record<string, unknown>,
): Promise<{ suggestion: string; fallback_agent?: string }> {
  const failedStep = String(args["failed_step"] ?? "");
  const error = String(args["error"] ?? "");

  // Simple rule-based recovery; in production → call glm_flash
  if (error.includes("timeout") || error.includes("ECONNREFUSED")) {
    return {
      suggestion:
        "Service is unreachable. Retry after 5 seconds or switch to fallback agent.",
      fallback_agent: "agent-lee-core",
    };
  }
  if (
    error.includes("auth") ||
    error.includes("401") ||
    error.includes("403")
  ) {
    return {
      suggestion: "Authentication failure. Check API keys in .env.local.",
      fallback_agent: undefined,
    };
  }
  return {
    suggestion: `Failed step "${failedStep}" with: ${error.slice(0, 120)}. Rephrase the task or route to agent-lee-core.`,
    fallback_agent: "agent-lee-core",
  };
}
