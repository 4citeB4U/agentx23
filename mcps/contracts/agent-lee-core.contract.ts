// LEEWAY v12 HEADER
// File: mcps/contracts/agent-lee-core.contract.ts
// Purpose: Agent Lee Core — typed contract for the lightweight sovereign kernel
// Security: LEEWAY-CORE-2026 compliant
// Discovery: ROLE=core; INTENT=orchestration; REGION=🧠 Identity/Router

/**
 * AGENT LEE CORE — SOVEREIGN KERNEL CONTRACT
 *
 * The core ONLY does:
 *   - Receive user request
 *   - Classify intent
 *   - Build context packet
 *   - Select MCP agent + model lane
 *   - Merge outputs from agents
 *   - Enforce policy/approvals
 *   - Produce final narration
 *   - Write mission summary to memory
 *
 * The core does NOT directly do:
 *   - Browser automation
 *   - Desktop/file ops
 *   - DB schema engineering
 *   - Heavy vision processing
 *   - Full testing pipelines
 *   - 3D generation
 */

// ─── Intent types ────────────────────────────────────────────────────────────

export type IntentClass =
  | "conversation" // Natural chat → Gemini lane
  | "planning" // Task decomposition → GLM-4.7-Flash → PlannerAgent
  | "desktop_action" // PC ops → DesktopCommanderAgent via Cerebral
  | "browser_action" // Web tasks → PlaywrightAgent
  | "vision" // Screenshots/images → VisionAgent → GLM-4.6V
  | "data_schema" // DB/records → InsForgeAgent
  | "testing" // QA/integrity → TestSpriteAgent
  | "ui_generation" // Components/screens → StitchAgent
  | "3d_generation" // 3D scenes/specs → SplineAgent
  | "memory_retrieval" // Context/recall → MemoryAgent
  | "voice" // Voice output → VoiceAgent
  | "system_health" // Status/diagnostics → HealthAgent
  | "unknown"; // Fallback to Planner

// ─── Model lanes ─────────────────────────────────────────────────────────────

export type ModelLane =
  | "gemini" // Natural conversation, final narration, multimodal
  | "glm_flash" // Fast planning, routing, mission summaries (GLM-4.7-Flash)
  | "glm_vision" // Visual analysis (GLM-4.6V-Flash)
  | "qwen_local" // Privacy-first, offline fallback (Qwen 2.5)
  | "qwen_vision_local" // Local image analysis (Qwen3-VL-2B)
  | "qwen_vision_deep" // Deep visual reasoning (Qwen3-Vision-7B)
  | "qwen_3d" // 3D scene generation (Qwen3-3D-1.8B)
  | "qwen_math" // Geometry + math (Qwen3-Math-4B)
  | "notebooklm" // Grounded knowledge recall
  | "none"; // Agent handles model selection internally

// ─── Request/Response ────────────────────────────────────────────────────────

export interface CoreRequest {
  request_id: string;
  user_input: string;
  source: "ui" | "voice" | "telegram" | "api" | "system";
  session_id: string;
  nav_context?: string; // e.g. "NAV:COMMS", "NAV:LIVE"
  attachments?: {
    type: "image" | "screenshot" | "file" | "audio";
    url?: string;
    base64?: string;
    mime?: string;
  }[];
  metadata?: Record<string, unknown>;
}

export interface CoreResponse {
  request_id: string;
  intent: IntentClass;
  model_lane: ModelLane;
  agent_used: string;
  narration: string;
  raw_agent_output?: unknown;
  mission_id: string;
  policy_flags: string[];
  timestamp: string;
}

export interface ContextPacket {
  request_id: string;
  user_input: string;
  intent: IntentClass;
  memory: string[]; // Recent relevant memories
  session_summary: string; // Compressed session so far
  agent_selected: string;
  model_lane: ModelLane;
  available_agents: string[]; // Agents currently healthy
  nav_context?: string;
  attachments?: CoreRequest["attachments"];
  timestamp: string;
}

export interface MissionSummary {
  mission_id: string;
  request_id: string;
  user_input: string;
  intent: IntentClass;
  agent: string;
  model_lane: ModelLane;
  plan: string[];
  steps_executed: {
    step: string;
    tool: string;
    result: string;
    verified: boolean;
    timestamp: string;
  }[];
  final_narration: string;
  success: boolean;
  error?: string;
  memory_written: boolean;
  duration_ms: number;
  timestamp: string;
}

// ─── Policy ──────────────────────────────────────────────────────────────────

export interface PolicyCheck {
  approved: boolean;
  flags: string[]; // e.g. "requires_confirmation", "destructive_op"
  reason?: string;
}

export interface CoreContract {
  name: "AgentLeeCore";
  mission: "Lightweight sovereign kernel — identity, policy, router, narrator";
  version: string;
  responsibilities: string[];
  does_not_do: string[];
  inputs: (keyof CoreRequest)[];
  outputs: (keyof CoreResponse)[];
  model_lanes: ModelLane[];
  deployment_location: "cloudflare" | "cerebral" | "local";
}

export const AGENT_LEE_CORE_CONTRACT: CoreContract = {
  name: "AgentLeeCore",
  mission: "Lightweight sovereign kernel — identity, policy, router, narrator",
  version: "1.0.0",
  responsibilities: [
    "Receive user requests from all surfaces (UI, voice, Telegram, API)",
    "Maintain Agent Lee's identity and persona",
    "Classify intent into typed IntentClass",
    "Assemble a ContextPacket for agent execution",
    "Select the correct MCP agent and ModelLane",
    "Enforce policy and approval rules before execution",
    "Merge outputs from multiple agents",
    "Produce final user-facing narration via Gemini lane",
    "Write MissionSummary to MemoryAgent after every interaction",
    "Maintain short session state",
    "Report system health via HealthAgent",
  ],
  does_not_do: [
    "Direct browser automation",
    "Direct desktop/file/process control",
    "Schema engineering or DB administration",
    "Heavy vision processing pipelines",
    "Full E2E/unit test execution",
    "3D scene generation",
    "Long-form planning across many steps",
    "Raw model inference routing (delegates to model lane services)",
  ],
  inputs: ["request_id", "user_input", "source", "session_id"],
  outputs: [
    "request_id",
    "intent",
    "model_lane",
    "agent_used",
    "narration",
    "mission_id",
  ],
  model_lanes: ["gemini", "glm_flash", "qwen_local"],
  deployment_location: "cloudflare",
};
