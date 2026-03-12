// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/tools/open-app.ts
// =============================================================================
import { spawn } from "child_process";

export async function openApp(
  args: Record<string, unknown>,
): Promise<{ launched: boolean; app: string }> {
  const app = String(args["app"] ?? "");
  const appArgs = (args["args"] as string[]) ?? [];
  if (!app) throw new Error("app is required");

  const child = spawn(app, appArgs, {
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();
  return { launched: true, app };
}
