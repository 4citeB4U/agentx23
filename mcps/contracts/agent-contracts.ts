// =============================================================================
// LEEWAY HEADER
// File: mcps/contracts/agent-contracts.ts
// Project: Agent Lee OS
// Purpose: Shared TypeScript contracts for all MCP agent services
// Created: 2025
// =============================================================================

export type IntentClass =
  | "converse"
  | "plan_task"
  | "recall_memory"
  | "write_memory"
  | "execute_code"
  | "execute_terminal"
  | "automate_browser"
  | "analyze_visual"
  | "generate_3d"
  | "translate_language"
  | "test_system"
  | "design_ui"
  | "speak_voice"
  | "orchestrate_agents";

export type ModelLane =
  | "gemini"
  | "glm_flash"
  | "glm_vision"
  | "qwen_local"
  | "qwen_vision_local"
  | "qwen_vision_deep"
  | "qwen_3d"
  | "qwen_math"
  | "notebooklm"
  | "none";

export type Platform = "cloudflare" | "vercel" | "cerebral" | "phone";
export type AgentStatus =
  | "online"
  | "offline"
  | "degraded"
  | "unknown"
  | "disabled";
export type AgentLayer =
  | "backbone"
  | "execution"
  | "perception"
  | "data"
  | "specialty";

// ---------------------------------------------------------------------------
// Context Packet — passed into every agent on every call
// ---------------------------------------------------------------------------
export interface ContextPacket {
  session_id: string;
  user_id: string;
  platform: Platform;
  intent: IntentClass;
  utterance: string;
  plan: string[];
  memory_snapshot: MemorySnapshot | null;
  tool_outputs: ToolOutput[];
  emotion_state?: EmotionState;
  persona?: PersonaHint;
  policy_flags: string[];
  timestamp: string;
  model_lane_override?: ModelLane | null;
}

export interface MemorySnapshot {
  summary: string;
  key_facts: string[];
  episode_ids: string[];
}

export interface ToolOutput {
  tool: string;
  result: unknown;
}

export interface EmotionState {
  mood: string;
  confidence: number; // 0–1
  energy: number; // 0–1
}

export interface PersonaHint {
  name: string;
  voice_id?: string;
  language?: string;
}

// ---------------------------------------------------------------------------
// Mission Summary — stored after each completed/abandoned mission
// ---------------------------------------------------------------------------
export interface Artifact {
  type: "file" | "url" | "image" | "component" | "test_report" | "voice_clip";
  ref: string;
  label?: string;
}

export type MissionStatus =
  | "completed"
  | "partial"
  | "failed"
  | "aborted"
  | "escalated";

export interface MissionSummary {
  mission_id: string;
  session_id: string;
  parent_mission_id?: string | null;
  original_utterance: string;
  intent: IntentClass;
  plan_executed: string[];
  agents_involved: string[];
  tools_used: string[];
  outcome_summary: string;
  artifacts: Artifact[];
  status: MissionStatus;
  error?: string | null;
  duration_ms: number;
  token_cost?: { input: number; output: number };
  model_lane_used: ModelLane;
  timestamp: string;
  key_learnings: string[];
}

// ---------------------------------------------------------------------------
// Core Request / Response — what the Kernel sends and expects back
// ---------------------------------------------------------------------------
export interface CoreRequest {
  context: ContextPacket;
  raw_message: string;
  attachments?: Array<{ mime_type: string; data: string }>;
}

export interface CoreResponse {
  reply: string;
  intent_resolved: IntentClass;
  model_lane_used: ModelLane;
  agents_called: string[];
  mission_summary?: MissionSummary;
  voice_text?: string;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// MCP Tool contract — every tool exposed by an agent
// ---------------------------------------------------------------------------
export interface MCPToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>; // JSON Schema
}

// ---------------------------------------------------------------------------
// Agent Registration — what every agent must export
// ---------------------------------------------------------------------------
export interface AgentRegistration {
  id: string;
  name: string;
  mission: string;
  layer: AgentLayer;
  tools: MCPToolDefinition[];
  model_lane: ModelLane;
  fallback_model_lane?: ModelLane;
  authority_boundaries: string;
  deployment_location: Platform | "remote" | "local";
  fallback_behavior: string;
  health_check: string; // tool name or HTTP path
  memory_scope: "session" | "mission" | "canonical" | "none";
}

// ---------------------------------------------------------------------------
// Policy Check
// ---------------------------------------------------------------------------
export interface PolicyCheck {
  allowed: boolean;
  reason?: string;
  flags: string[];
}

// ---------------------------------------------------------------------------
// Intent Router Map — Kernel's dispatch table
// ---------------------------------------------------------------------------
export type IntentRouterMap = {
  [K in IntentClass]: {
    primary_agent: string;
    model_lane: ModelLane;
    fallback_agents?: string[];
  };
};
