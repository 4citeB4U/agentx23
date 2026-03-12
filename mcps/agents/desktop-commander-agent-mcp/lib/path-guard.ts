// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/lib/path-guard.ts
// Purpose: Enforce allowlisted root directories for all file operations
// =============================================================================
import { normalize, resolve } from "path";

const ALLOWED_ROOTS: string[] = [
  "C:\\Tools\\Portable-VSCode-MCP-Kit",
  "C:\\Users\\Agent Lee\\Projects",
  "C:\\Users\\Agent Lee\\Desktop",
];

export function assertAllowedPath(rawPath: string): string {
  const normalized = normalize(resolve(rawPath));
  const allowed = ALLOWED_ROOTS.some((root) =>
    normalized.startsWith(normalize(root)),
  );
  if (!allowed) {
    throw new Error(
      `[DesktopCommanderAgent] Path "${normalized}" is outside allowed roots. Access denied.`,
    );
  }
  return normalized;
}
