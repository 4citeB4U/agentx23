/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.TYPES

5WH:
WHAT = Agent Workspace state types and event model (Phase 4)
WHY = Real device bridge, TTS narration, digital-life flows, full verification
WHO = LEEWAY / Agent Workspace Rewrite
WHERE = .Agent_Lee_OS/components/agent-workspace/types.ts
WHEN = 2026
HOW = Phase 4: real device actions, digital life operator, narration engine

LICENSE:
MIT
*/

// ── Agent Status State Machine ─────────────────────────────────────────────
export type AgentStatus =
  | "idle"
  | "planning"
  | "researching"
  | "reading"
  | "executing"
  | "verifying"
  | "awaiting_approval"
  | "replanning"
  | "finalizing"
  | "complete"
  | "error";

// ── Narration Mode ─────────────────────────────────────────────────────────
export type NarrationMode = "silent" | "guided" | "full" | "conversational";

// ── Narration Hook ─────────────────────────────────────────────────────────
// Fired by the controller at structured points; a TTS or UI layer can consume.
export interface NarrationHook {
  /** Which narration point triggered */
  point:
    | "goal_received"
    | "plan_ready"
    | "step_started"
    | "step_done"
    | "step_failed"
    | "replan_triggered"
    | "task_completed"
    | "research_found"
    | "approval_needed"
    | "device_action"
    // Phase 4 additions
    | "digital_life_started"
    | "digital_life_completed"
    | "device_verified";
  /** Short utterance for TTS */
  utterance: string;
  /** Timestamp */
  timestamp: number;
  /** Optional structured data */
  data?: any;
}

/** Callback listeners can subscribe to narration hooks */
export type NarrationListener = (hook: NarrationHook) => void;

// ── Active Tool ────────────────────────────────────────────────────────────
export type ActiveTool =
  | "none"
  | "terminal"
  | "editor"
  | "browser"
  | "files"
  | "preview";

// ── Sidebar Section ────────────────────────────────────────────────────────
export type SidebarSection =
  | "task"
  | "plan"
  | "tools"
  | "files"
  | "browser"
  | "terminal"
  | "artifacts"
  | "memory"
  | "settings";

// ── Thread Event Types ─────────────────────────────────────────────────────
export type ThreadEventType =
  | "goal"
  | "plan"
  | "search"
  | "read_file"
  | "write_file"
  | "command"
  | "build"
  | "test"
  | "verify"
  | "approval"
  | "artifact"
  | "narration"
  | "error"
  | "mcp_dispatch"
  | "complete"
  | "thinking"
  | "user_message"
  // Phase 3 additions
  | "research"     // structured research workflow
  | "replan"       // replanning after failure
  | "device"       // device bridge action
  | "retrieval"    // workspace/memory/log retrieval
  | "summarize"    // summarization step
  // Phase 4 additions
  | "digital_life" // digital-life operator flow
  | "phone_action" // phone-specific device action
  | "diagnostic"   // device diagnostic result
  | "tool_call"    // generic tool start/call
  | "mcp_invoke";  // mcp invocation start;

export interface ThreadEvent {
  id: string;
  type: ThreadEventType;
  timestamp: number;
  title: string;
  /** Body text / detail */
  content: string;
  /** Which tool was used (optional) */
  tool?: string;
  /** MCP agent name (optional) */
  agent?: string;
  /** Current status */
  status: "pending" | "running" | "success" | "error" | "approval_needed";
  /** Verification evidence */
  verification?: {
    verified: boolean;
    evidence: string;
  };
  /** For approval events: user response */
  approvalState?: "pending" | "approved" | "denied";
  /** Nested data (command output, search results, file content, etc) */
  data?: any;
  /** Step index if part of a plan */
  stepIndex?: number;
  /** Retry attempt number (Phase 3) */
  retryAttempt?: number;
  /** Whether this step was MCP-routed */
  mcpRouted?: boolean;
}

// ── Plan Types ─────────────────────────────────────────────────────────────
export interface PlanStep {
  index: number;
  title: string;
  description: string;
  tool?: string;
  status: "pending" | "running" | "done" | "error" | "skipped" | "retrying";
  /** Retry configuration */
  maxRetries?: number;
  retryCount?: number;
  /** Whether this step should attempt MCP routing */
  mcpEligible?: boolean;
  /** Replan note if modified during execution */
  replanNote?: string;
}

export interface TaskPlan {
  goal: string;
  steps: PlanStep[];
  currentStep: number;
  estimatedMinutes?: number;
  /** Number of times the plan has been revised */
  revisionCount?: number;
  /** Source of the plan: backend, client, or replan */
  source?: "backend" | "client" | "replan";
}

// ── Artifact Types ─────────────────────────────────────────────────────────
export interface Artifact {
  id: string;
  name: string;
  type: "code" | "file" | "report" | "preview" | "scaffold" | "patch";
  content: string;
  path?: string;
  timestamp: number;
}

// ── VFS Types (preserved from LeeVM) ───────────────────────────────────────
export interface VFSFile {
  name: string;
  content?: string;
  type: "file";
  path: string;
  size?: number;
  modified?: string;
}

export interface VFSDirectory {
  name: string;
  type: "dir";
  path: string;
  children: (VFSFile | VFSDirectory)[];
}

export type VFSItem = VFSFile | VFSDirectory;

// ── Sandbox Job (preserved from LeeVM) ─────────────────────────────────────
export interface SandboxJob {
  id: string;
  cmd: string;
  cwd: string;
  status: "running" | "done" | "error";
  started: string;
  ended?: string;
  exitCode?: number;
  output?: string;
}

// ── Device Bridge Contract (Phase 4 — Real Implementations) ────────────────
// These define the shape of device/desktop actions that Agent Lee can
// request. Phase 4 provides real platform connections via MCP, companion
// apps, URL schemes, and Web APIs. Stubs are only used as last resort.
export interface DeviceBridgeAction {
  action:
    // Phase 3 originals
    | "open_app"
    | "launch_intent"
    | "inspect_device_state"
    | "inspect_bluetooth"
    | "open_system_panel"
    | "verify_action"
    // Phase 4 additions
    | "open_phone_dialer"
    | "open_calendar"
    | "open_maps"
    | "open_messages"
    | "open_email"
    | "open_settings_panel"
    | "inspect_battery"
    | "inspect_network";
  params: Record<string, any>;
}

export interface DeviceBridgeResult {
  success: boolean;
  action: string;
  summary: string;
  data: any;
  /** Whether this is a stub (not wired to real device yet) */
  stub: boolean;
  /** Whether the action was verified (Phase 4) */
  verified?: boolean;
  /** Verification evidence string (Phase 4) */
  verificationEvidence?: string;
}

// ── Central Workspace State ────────────────────────────────────────────────
export interface WorkspaceState {
  /** Unique session identifier */
  sessionId: string;
  /** The user's current goal / task */
  goal: string;
  /** Agent's current status */
  status: AgentStatus;
  /** Active tool panel on the right */
  activeTool: ActiveTool;
  /** Active sidebar section */
  activeSection: SidebarSection;
  /** Task plan (if generated) */
  plan: TaskPlan | null;
  /** Chronological thread of events */
  thread: ThreadEvent[];
  /** Pending approval requests */
  approvals: ThreadEvent[];
  /** Generated artifacts */
  artifacts: Artifact[];
  /** Virtual filesystem tree */
  vfs: VFSDirectory;
  /** Running sandbox jobs */
  jobs: SandboxJob[];
  /** Narration mode */
  narrationMode: NarrationMode;
  /** Narration listeners */
  narrationListeners: NarrationListener[];
  /** Approval mode: if true, all mutations need approval */
  approvalMode: boolean;
  /** Last verification summary */
  verificationSummary: string;
  /** Is the agent currently "thinking" / processing */
  isThinking: boolean;
  /** File currently open in editor */
  editorFile: string | null;
  /** Running job count */
  runningJobs: number;
  /** MCP bridge online */
  mcpBridgeOnline: boolean;
  /** Backend ready */
  backendReady: boolean;
  /** TTS narration engine enabled */
  ttsEnabled: boolean;
  /** Recent device context (Phase 4) */
  deviceContext: Record<string, any> | null;
  /** Research context accumulated during plan execution */
  researchContext: string[];
  /** Leeway SDK Status (Phase 4) */
  leewayStatus: {
    online: boolean;
    version: string;
    score: number | null;
    level: string;
  } | null;
}

// Initial state factory
export function createInitialState(): WorkspaceState {
  return {
    sessionId: `session_${Date.now()}`,
    goal: "",
    status: "idle",
    activeTool: "none",
    activeSection: "task",
    plan: null,
    thread: [],
    approvals: [],
    artifacts: [],
    vfs: {
      name: "root",
      type: "dir",
      path: "/",
      children: [
        {
          name: "home",
          type: "dir",
          path: "/home",
          children: [
            {
              name: "agent_lee",
              type: "dir",
              path: "/home/agent_lee",
              children: [
                {
                  name: "welcome.txt",
                  type: "file",
                  path: "/home/agent_lee/welcome.txt",
                  content:
                    "Welcome to Agent Lee Workspace — LEE_VM_01\nPolicy: Workspace-First\nAll tasks run here before any real files are touched.",
                },
                {
                  name: "projects",
                  type: "dir",
                  path: "/home/agent_lee/projects",
                  children: [],
                },
                {
                  name: "output",
                  type: "dir",
                  path: "/home/agent_lee/output",
                  children: [],
                },
              ],
            },
          ],
        },
        { name: "tmp", type: "dir", path: "/tmp", children: [] },
      ],
    },
    jobs: [],
    narrationMode: "guided",
    narrationListeners: [],
    approvalMode: true,
    verificationSummary: "",
    isThinking: false,
    editorFile: null,
    runningJobs: 0,
    mcpBridgeOnline: false,
    backendReady: false,
    ttsEnabled: true,
    deviceContext: null,
    researchContext: [],
    leewayStatus: null,
  };
}

// ── Thread Event Factory ───────────────────────────────────────────────────
export function createThreadEvent(
  type: ThreadEventType,
  title: string,
  content: string,
  extra: Partial<ThreadEvent> = {},
): ThreadEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: Date.now(),
    title,
    content,
    status: "pending",
    ...extra,
  };
}

// ── Narration Hook Factory ─────────────────────────────────────────────────
export function createNarrationHook(
  point: NarrationHook["point"],
  utterance: string,
  data?: any,
): NarrationHook {
  return { point, utterance, timestamp: Date.now(), data };
}
