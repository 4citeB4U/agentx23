// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/tools/compress-session.ts
// =============================================================================

export async function compressSession(
  args: Record<string, unknown>,
): Promise<{ summary: string; key_facts: string[] }> {
  const messages =
    (args["messages"] as Array<{ role: string; content: string }>) ?? [];
  const userTurns = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .slice(-10);
  const summary = userTurns.length
    ? `Session covered: ${userTurns.map((t) => t.slice(0, 60)).join("; ")}`
    : "No user messages found.";
  return { summary, key_facts: [] };
}
