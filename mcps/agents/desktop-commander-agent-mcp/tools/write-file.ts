// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/tools/write-file.ts
// =============================================================================
import { appendFile, mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { assertAllowedPath } from "../lib/path-guard.js";

const AUDIT_LOG = "backend/logs/desktop-commander-audit.jsonl";

export async function writeHostFile(
  args: Record<string, unknown>,
): Promise<{ written: boolean; path: string }> {
  const safePath = assertAllowedPath(String(args["path"] ?? ""));
  const content = String(args["content"] ?? "");
  const doAppend = Boolean(args["append"] ?? false);

  await mkdir(dirname(safePath), { recursive: true });
  if (doAppend) {
    await appendFile(safePath, content, "utf-8");
  } else {
    await writeFile(safePath, content, "utf-8");
  }

  const logEntry = {
    ts: new Date().toISOString(),
    tool: "write_file",
    path: safePath,
    bytes: content.length,
    append: doAppend,
  };
  await appendFile(AUDIT_LOG, JSON.stringify(logEntry) + "\n", "utf-8").catch(
    () => {},
  );

  return { written: true, path: safePath };
}
