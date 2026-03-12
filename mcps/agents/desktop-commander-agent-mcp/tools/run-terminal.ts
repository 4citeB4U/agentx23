// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/tools/run-terminal.ts
// =============================================================================
import { exec } from "child_process";
import { appendFile } from "fs/promises";
import { promisify } from "util";
import { assertAllowedPath } from "../lib/path-guard.js";

const execAsync = promisify(exec);
const AUDIT_LOG = "backend/logs/desktop-commander-audit.jsonl";
const DEFAULT_CWD = "C:\\Tools\\Portable-VSCode-MCP-Kit";

export async function runTerminal(args: Record<string, unknown>): Promise<{
  stdout: string;
  stderr: string;
  exit_code: number;
}> {
  const command = String(args["command"] ?? "").trim();
  const rawCwd = String(args["cwd"] ?? DEFAULT_CWD);
  const timeout = Number(args["timeout_ms"] ?? 30_000);

  if (!command) throw new Error("command is required");

  const cwd = assertAllowedPath(rawCwd);

  const logEntry = {
    ts: new Date().toISOString(),
    tool: "run_terminal",
    command,
    cwd,
  };
  await appendFile(AUDIT_LOG, JSON.stringify(logEntry) + "\n", "utf-8").catch(
    () => {},
  );

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 4,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exit_code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? String(err)).trim(),
      exit_code: e.code ?? 1,
    };
  }
}
