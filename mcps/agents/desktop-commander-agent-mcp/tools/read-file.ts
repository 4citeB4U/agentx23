// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/tools/read-file.ts
// =============================================================================
import { readFile } from "fs/promises";
import { assertAllowedPath } from "../lib/path-guard.js";

export async function readHostFile(
  args: Record<string, unknown>,
): Promise<{ content: string; path: string }> {
  const safePath = assertAllowedPath(String(args["path"] ?? ""));
  const content = await readFile(safePath, "utf-8");
  return { content, path: safePath };
}
