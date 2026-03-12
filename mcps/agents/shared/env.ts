// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/shared/env.ts
// Project: Agent Lee OS — Shared Utilities
// Purpose: Safe env-var accessor for MCP agent servers
// =============================================================================
import "dotenv/config";

export function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function envRequired(key: string): string {
  const val = process.env[key];
  if (!val)
    throw new Error(`[AgentLeeOS] Required env var "${key}" is not set.`);
  return val;
}
