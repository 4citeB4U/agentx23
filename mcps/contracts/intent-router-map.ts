// =============================================================================
// LEEWAY HEADER
// File: mcps/contracts/intent-router-map.ts
// Project: Agent Lee OS
// Purpose: Canonical dispatch table — intent → agent + model lane
// =============================================================================
import type { IntentRouterMap } from "./agent-contracts";

export const INTENT_ROUTER_MAP: IntentRouterMap = {
  converse: {
    primary_agent: "agent-lee-core",
    model_lane: "gemini",
    fallback_agents: ["memory-agent-mcp"],
  },
  plan_task: {
    primary_agent: "planner-agent-mcp",
    model_lane: "glm_flash",
    fallback_agents: ["agent-lee-core"],
  },
  recall_memory: {
    primary_agent: "memory-agent-mcp",
    model_lane: "notebooklm",
    fallback_agents: ["agent-lee-core"],
  },
  write_memory: {
    primary_agent: "memory-agent-mcp",
    model_lane: "notebooklm",
    fallback_agents: ["insforge-agent-mcp"],
  },
  execute_code: {
    primary_agent: "desktop-commander-agent-mcp",
    model_lane: "qwen_local",
    fallback_agents: ["agent-lee-core"],
  },
  execute_terminal: {
    primary_agent: "desktop-commander-agent-mcp",
    model_lane: "qwen_local",
    fallback_agents: [],
  },
  automate_browser: {
    primary_agent: "playwright-agent-mcp",
    model_lane: "qwen_local",
    fallback_agents: ["desktop-commander-agent-mcp"],
  },
  analyze_visual: {
    primary_agent: "vision-agent-mcp",
    model_lane: "glm_vision",
    fallback_agents: ["agent-lee-core"],
  },
  generate_3d: {
    primary_agent: "spline-agent-mcp",
    model_lane: "qwen_3d",
    fallback_agents: [],
  },
  translate_language: {
    primary_agent: "agent-lee-core",
    model_lane: "gemini",
    fallback_agents: [],
  },
  test_system: {
    primary_agent: "testsprite-agent-mcp",
    model_lane: "qwen_local",
    fallback_agents: ["playwright-agent-mcp"],
  },
  design_ui: {
    primary_agent: "stitch-agent-mcp",
    model_lane: "gemini",
    fallback_agents: ["agent-lee-core"],
  },
  speak_voice: {
    primary_agent: "voice-agent-mcp",
    model_lane: "gemini",
    fallback_agents: ["agent-lee-core"],
  },
  orchestrate_agents: {
    primary_agent: "planner-agent-mcp",
    model_lane: "glm_flash",
    fallback_agents: ["agent-lee-core"],
  },
};
