// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/tools/kill-process.ts
// =============================================================================
import { exec } from "child_process";
import { appendFile } from "fs/promises";
import { promisify } from "util";

const execAsync = promisify(exec);
const AUDIT_LOG = "backend/logs/desktop-commander-audit.jsonl";

export async function killProcess(
  args: Record<string, unknown>,
): Promise<{ killed: boolean; target: string }> {
  const target = String(args["target"] ?? "").trim();
  const force = Boolean(args["force"] ?? false);
  if (!target) throw new Error("target is required");

  const isNumeric = /^\d+$/.test(target);
  let cmd: string;
  if (isNumeric) {
    cmd = force ? `taskkill /PID ${target} /F` : `taskkill /PID ${target}`;
  } else {
    cmd = force ? `taskkill /IM "${target}" /F` : `taskkill /IM "${target}"`;
  }

  const logEntry = {
    ts: new Date().toISOString(),
    tool: "kill_process",
    target,
    force,
  };
  await appendFile(AUDIT_LOG, JSON.stringify(logEntry) + "\n", "utf-8").catch(
    () => {},
  );

  try {
    await execAsync(cmd);
    return { killed: true, target };
  } catch (err) {
    return { killed: false, target };
  }
}
