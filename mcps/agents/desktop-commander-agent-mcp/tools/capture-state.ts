// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/tools/capture-state.ts
// =============================================================================
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function captureState(args: Record<string, unknown>): Promise<{
  processes: string;
  memory: string;
  disk: string;
  timestamp: string;
}> {
  const [procs, mem, disk] = await Promise.allSettled([
    execAsync("tasklist /fo csv /nh").then((r) =>
      r.stdout.trim().split("\n").slice(0, 20).join("\n"),
    ),
    execAsync(
      "wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value",
    ).then((r) => r.stdout.trim()),
    execAsync("wmic logicaldisk get Caption,FreeSpace,Size /value").then((r) =>
      r.stdout.trim(),
    ),
  ]);

  return {
    processes: procs.status === "fulfilled" ? procs.value : "unavailable",
    memory: mem.status === "fulfilled" ? mem.value : "unavailable",
    disk: disk.status === "fulfilled" ? disk.value : "unavailable",
    timestamp: new Date().toISOString(),
  };
}
