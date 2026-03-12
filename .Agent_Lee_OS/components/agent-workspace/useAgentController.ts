/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.CONTROLLER
LICENSE: MIT

PURPOSE: Phase 3 agent controller.
         - Real planner output model (backend + enhanced client decomposition)
         - MCP routing for eligible steps
         - Replan/retry on failure instead of just skipping
         - Event-stream narration hooks aligned with real actions
         - Research workflow support
         - Device bridge integration

LOOP: Goal → Plan → [Step: Route → Execute → Verify → (Replan?)] → Complete
*/

import { useCallback, useRef } from "react";
import {
  ActiveTool,
  NarrationHook,
  NarrationListener,
  PlanStep,
  TaskPlan,
  ThreadEvent,
  WorkspaceState,
  createNarrationHook,
  createThreadEvent,
} from "./types";
import {
  ToolName,
  ToolResult,
  TOOL_TO_PANEL,
  MCP_ELIGIBLE,
  dispatchTool,
} from "./toolDispatcher";
import { detectDigitalLifeFlow } from "./digitalLifeOperator";

// ── API Helper ─────────────────────────────────────────────────────────────
const HANDSHAKE =
  (import.meta as any)?.env?.VITE_NEURAL_HANDSHAKE ||
  localStorage.getItem("AGENT_LEE_KEY") ||
  "AGENT_LEE_SOVEREIGN_V1";

const vmFetch = (url: string, opts: RequestInit = {}) =>
  fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-neural-handshake": HANDSHAKE,
      ...(opts.headers as any),
    },
  });

// ══════════════════════════════════════════════════════════════════════════
//  PLANNER OUTPUT MODEL
// ══════════════════════════════════════════════════════════════════════════

interface ParsedAction {
  tool: ToolName;
  params: Record<string, any>;
  title: string;
  description: string;
  /** Retry config: how many times to retry on failure */
  maxRetries: number;
  /** Whether this is MCP-eligible */
  mcpEligible: boolean;
}

// ── All known tool names for pattern matching ──────────────────────────────
const ALL_TOOLS: ToolName[] = [
  "search_web", "read_file", "write_file", "run_terminal",
  "search_workspace", "search_memory", "search_logs",
  "list_directory", "summarize_file", "research",
  "open_app", "launch_intent", "inspect_device_state",
  "inspect_bluetooth", "open_system_panel", "verify_action",
  // Phase 4 Leeway SDK
  "leeway_doctor", "leeway_assess", "leeway_audit", "leeway_explain", "leeway_route", "leeway_health"
];

// ── Client-side planner ────────────────────────────────────────────────────
function decomposeGoal(goal: string): ParsedAction[] {
  const actions: ParsedAction[] = [];

  // Split on multi-clause connectors
  const clauses = goal
    .split(/(?:,\s*then\s+|,?\s+then\s+|,\s+and\s+|;\s*)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const cl = clause.toLowerCase();

    // ── Inspect / examine the workspace ─────────────────────────────────
    if (/(?:inspect|examine|explore|scan)\s+(?:the\s+)?workspace/i.test(cl)) {
      actions.push(act("list_directory", { path: "/home/agent_lee" }, `Inspect workspace`, `Listing workspace directory`));
      continue;
    }

    // ── Search for / find / locate (workspace first) ────────────────────
    const searchForMatch = cl.match(
      /(?:search\s+for|find|locate|look\s+for|search)\s+(?:the\s+)?(.+?)(?:\s+in\s+(?:the\s+)?(?:workspace|files|project|code))?$/i,
    );
    if (searchForMatch && !/(?:web|online|google|internet)/i.test(cl)) {
      const query = searchForMatch[1].replace(/(?:issue|bug|error|problem)s?\s*$/i, "error").trim();
      actions.push(act("search_workspace", { query }, `Search workspace: "${query}"`, `Searching workspace files for "${query}"`));
      continue;
    }

    // ── Fix / patch / edit file ──────────────────────────────────────────
    const fixMatch = cl.match(/(?:fix|patch|edit|update|modify)\s+(?:it\s+)?(?:in\s+)?(?:the\s+)?(?:workspace\s+)?(?:copy\s+)?(?:of\s+)?(?:file\s+)?["`']?([^\s"'`]+\.\w+)?["`']?/i);
    if (fixMatch) {
      const filePath = fixMatch[1] ? (fixMatch[1].startsWith("/") ? fixMatch[1] : `/home/agent_lee/${fixMatch[1]}`) : "";
      if (filePath) {
        // Read first, then write (two steps)
        actions.push(act("read_file", { path: filePath }, `Read ${fixMatch[1]}`, `Reading file for editing`, 1));
        actions.push(act("write_file", { path: filePath, content: "" }, `Fix ${fixMatch[1]} in workspace`, `Fixing file in workspace copy`, 2));
      } else {
        // Generic fix — search first
        actions.push(act("search_workspace", { query: "error" }, `Search for issues`, `Searching workspace for errors`, 1));
      }
      continue;
    }

    // ── Research / deep search (web) ────────────────────────────────────
    if (/(?:research|deep\s+search|investigate)/i.test(cl)) {
      const topic = cl.replace(/(?:research|deep\s+search|investigate)\s+/i, "").trim();
      actions.push(act("research", { topic, queries: [topic, `${topic} solution`, `${topic} fix`] }, `Research: ${topic.slice(0, 50)}`, `Structured research on "${topic}"`));
      continue;
    }

    // ── Search web explicitly ───────────────────────────────────────────
    if (/(?:search\s+(?:the\s+)?web|google|look\s+up\s+online|find\s+online|web\s+search)/i.test(cl)) {
      const q = cl.replace(/(?:search\s+(?:the\s+)?web\s+(?:for\s+)?|google\s+|look\s+up\s+online\s+|find\s+online\s+|web\s+search\s+(?:for\s+)?)/i, "").trim();
      actions.push(act("search_web", { query: q }, `Web search: "${q.slice(0, 50)}"`, `Searching the web for "${q}"`));
      continue;
    }

    // ── Summarize / report ──────────────────────────────────────────────
    if (/(?:summarize|report|summary|wrap\s*up|recap|describe)\s+(?:the\s+)?(?:result|findings|output|build|test)?/i.test(cl)) {
      actions.push(act("run_terminal", {
        cmd: `echo "── Summary Report ──" && echo "Task: ${goal.replace(/"/g, '\\"').slice(0, 80)}" && echo "Status: Steps completed — see verification above" && echo "Generated: $(date)" && echo "────────────────────"`,
        reason: "Generating summary report",
      }, `Summary report`, `Generating a structured summary`, 0));
      continue;
    }

    // ── Read file patterns ──────────────────────────────────────────────
    const readMatch =
      cl.match(/(?:read|open|show|cat|view|look\s+at|check|inspect)\s+(?:the\s+)?(?:file\s+)?["`']?([^\s"'`,;]+\.\w+)["`']?/) ||
      cl.match(/(?:read|open|show|cat|view)\s+([^\s,;]+)/);
    if (readMatch) {
      const fp = readMatch[1].startsWith("/") ? readMatch[1] : `/home/agent_lee/${readMatch[1]}`;
      actions.push(act("read_file", { path: fp }, `Read ${readMatch[1]}`, `Reading ${fp}`, 1));
      continue;
    }

    // ── Run / execute / rerun / rebuild ──────────────────────────────────
    const rerunMatch = cl.match(/(?:rerun|rebuild|re-run|re-build)\s+(?:the\s+)?(.+)/i);
    if (rerunMatch) {
      const cmd = rerunMatch[1].replace(/^["'`]+|["'`]+$/g, "").trim();
      actions.push(act("run_terminal", { cmd }, `Rerun: ${cmd.slice(0, 50)}`, `Re-executing "${cmd}" after fixes`, 2));
      continue;
    }

    const runMatch = cl.match(/(?:run|execute|do)\s+["`']?(.+?)["`']?\s*$/i);
    if (runMatch) {
      const cmd = runMatch[1].replace(/^["'`]+|["'`]+$/g, "").trim();
      actions.push(act("run_terminal", { cmd }, `Run: ${cmd.slice(0, 50)}`, `Executing "${cmd}" in sandbox`, 1));
      continue;
    }

    // Bare command patterns
    if (/^(?:npm|npx|node|yarn|pnpm|cargo|python|pip|git|make|docker|ls|cat|echo|grep|find|mkdir|touch|rm|mv|cp|pwd|which|curl|wget)\s+/i.test(cl)) {
      actions.push(act("run_terminal", { cmd: clause.trim() }, `Run: ${clause.trim().slice(0, 50)}`, `Executing "${clause.trim()}"`, 1));
      continue;
    }

    // ── Write / create file ─────────────────────────────────────────────
    const writeMatch = cl.match(/(?:write|create|save|make)\s+(?:a\s+)?(?:file\s+)?(?:called\s+|named\s+)?["`']?([^\s"'`]+)["`']?/);
    if (writeMatch) {
      const fp = writeMatch[1].startsWith("/") ? writeMatch[1] : `/home/agent_lee/${writeMatch[1]}`;
      actions.push(act("write_file", { path: fp, content: "" }, `Create ${writeMatch[1]}`, `Creating ${fp}`));
      continue;
    }

    // ── List directory ──────────────────────────────────────────────────
    if (/(?:list|ls|dir)\s+(?:the\s+)?(?:files|directory|folder|contents)/i.test(cl)) {
      const pathMatch = cl.match(/(?:in|of|at)\s+([^\s]+)/);
      actions.push(act("list_directory", { path: pathMatch?.[1] || "/home/agent_lee" }, `List directory`, `Listing workspace files`));
      continue;
    }

    // ── Search memory ───────────────────────────────────────────────────
    if (/(?:remember|recall|memory|past\s+(?:work|sessions?))/i.test(cl)) {
      const q = cl.replace(/(?:remember|recall|search\s+memory\s+(?:for\s+)?|check\s+memory\s+(?:for\s+)?)/i, "").trim();
      actions.push(act("search_memory", { query: q || goal }, `Memory search: "${q.slice(0, 40)}"`, `Searching agent memory`));
      continue;
    }

    // ── Search logs ─────────────────────────────────────────────────────
    if (/(?:check|search|scan)\s+(?:the\s+)?logs?\s*/i.test(cl)) {
      const q = cl.replace(/(?:check|search|scan)\s+(?:the\s+)?logs?\s+(?:for\s+)?/i, "").trim();
      actions.push(act("search_logs", { query: q || "error" }, `Search logs: "${q.slice(0, 40)}"`, `Searching agent logs`));
      continue;
    }

    // ── Leeway SDK ───────────────────────────────────────────────────────
    if (/(?:system\s+doctor|diagnose|leeway\s+doctor)/i.test(cl)) {
      actions.push(act("leeway_doctor", {}, `System diagnosis`, `Running LEEWAY™ DoctorAgent`));
      continue;
    }
    if (/(?:assess|survey)\s+(?:the\s+)?(?:workspace|project)/i.test(cl)) {
      actions.push(act("leeway_assess", { rootDir: "/home/agent_lee" }, `Workspace assessment`, `Running LEEWAY™ AssessAgent`));
      continue;
    }
    if (/(?:audit|score|check)\s+(?:the\s+)?(?:code|compliance|workspace|project)/i.test(cl) || /(?:leeway\s+audit)/i.test(cl)) {
      actions.push(act("leeway_audit", { rootDir: "/home/agent_lee" }, `Compliance audit`, `Running LEEWAY™ AuditAgent`));
      continue;
    }
    if (/(?:explain|describe)(?:\s+this)?\s+file\s+["`']?([^\s"'`]+)["`']?/i.test(cl)) {
      const match = cl.match(/(?:explain|what\s+does|describe)\s+(?:the\s+)?(?:file\s+)?["`']?([^\s"'`]+)["`']?/i);
      const fs = match?.[1] || "";
      const fp = fs.startsWith("/") ? fs : `/home/agent_lee/${fs}`;
      actions.push(act("leeway_explain", { filePath: fp }, `Explain ${fs}`, `Running LEEWAY™ ExplainAgent`));
      continue;
    }
    if (/(?:route|delegate)\s+(?:task|intent)\s*["`']?(.+?)["`']?$/i.test(cl)) {
      const match = cl.match(/(?:route|delegate)\s+(?:task|intent)\s*["`']?(.+?)["`']?$/i);
      actions.push(act("leeway_route", { task: match?.[1] || goal }, `Route task`, `Running LEEWAY™ RouterAgent`));
      continue;
    }
    if (/(?:system\s+health|healthy\?)/i.test(cl)) {
      actions.push(act("leeway_health", {}, `System health`, `Running LEEWAY™ HealthAgentLite`));
      continue;
    }

    // ── Device bridge patterns ──────────────────────────────────────────
    if (/(?:open\s+(?:the\s+)?app)\s+/i.test(cl)) {
      const app = cl.replace(/open\s+(?:the\s+)?app\s+/i, "").trim();
      actions.push(act("open_app", { appName: app }, `Open app: ${app}`, `Opening ${app} on device`));
      continue;
    }
    if (/(?:bluetooth|bt)\s+/i.test(cl)) {
      actions.push(act("inspect_bluetooth", {}, `Inspect Bluetooth`, `Checking Bluetooth state`));
      continue;
    }
    if (/(?:device\s+state|system\s+info|battery)/i.test(cl)) {
      actions.push(act("inspect_device_state", {}, `Inspect device`, `Checking device state`));
      continue;
    }

    // ── Fallback: terminal command ──────────────────────────────────────
    if (clause.trim().length > 2) {
      actions.push(act("run_terminal", { cmd: clause.trim() }, `Execute: ${clause.trim().slice(0, 50)}`, `Running "${clause.trim()}"`, 1));
    }
  }

  return actions;
}

/** Helper to build a ParsedAction with defaults */
function act(tool: ToolName, params: Record<string, any>, title: string, description: string, maxRetries: number = 0): ParsedAction {
  return { tool, params, title, description, maxRetries, mcpEligible: MCP_ELIGIBLE.has(tool) };
}

// ══════════════════════════════════════════════════════════════════════════
//  REPLANNER
// ══════════════════════════════════════════════════════════════════════════

/** Attempt to generate a recovery plan for a failed step */
function replanForFailure(
  failedStep: PlanStep,
  failedResult: ToolResult,
  remainingActions: ParsedAction[],
  goal: string,
): ParsedAction[] {
  const recovery: ParsedAction[] = [];
  const failTool = failedStep.tool as ToolName;
  const failEvidence = failedResult.verification.evidence;

  // Strategy 1: If a build/run failed, search for the error first
  if (failTool === "run_terminal" && failedResult.data?.output) {
    const output = failedResult.data.output as string;
    // Extract first error line
    const errorLine = output.split("\n").find((l) =>
      /(?:error|ERR!|FAIL|fatal|exception|cannot|not found)/i.test(l),
    );
    if (errorLine) {
      const errorQuery = errorLine.replace(/[^a-zA-Z0-9\s]/g, "").trim().slice(0, 60);
      recovery.push(act("search_workspace", { query: errorQuery }, `Search for error: "${errorQuery.slice(0, 40)}"`, `Searching workspace for the root cause`, 0));
      recovery.push(act("search_web", { query: `${errorQuery} fix` }, `Web search: "${errorQuery.slice(0, 40)} fix"`, `Searching for solutions online`, 0));
    }
  }

  // Strategy 2: If a file read failed, try listing the directory
  if (failTool === "read_file") {
    const dir = (failedStep as any).params?.path?.replace(/\/[^/]+$/, "") || "/home/agent_lee";
    recovery.push(act("list_directory", { path: dir }, `List: ${dir}`, `Looking for the correct file path`));
  }

  // Strategy 3: If a search failed, broaden the query
  if (failTool === "search_workspace" || failTool === "search_web") {
    const broadened = goal.split(" ").slice(0, 3).join(" ");
    recovery.push(act("search_web", { query: broadened }, `Broader search: "${broadened}"`, `Trying a broader search query`));
  }

  // Re-add remaining actions after recovery
  recovery.push(...remainingActions);

  return recovery;
}

// ══════════════════════════════════════════════════════════════════════════
//  NARRATION ENGINE
// ══════════════════════════════════════════════════════════════════════════

/** Fires a narration hook to all listeners */
function fireNarration(
  listeners: NarrationListener[],
  hook: NarrationHook,
): void {
  for (const listener of listeners) {
    try {
      listener(hook);
    } catch { /* listener error should not break the agent loop */ }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTROLLER HOOK
// ══════════════════════════════════════════════════════════════════════════

export interface AgentControllerAPI {
  executeGoal: (goal: string) => Promise<void>;
  stop: () => void;
  isRunning: boolean;
  /** Register a narration listener */
  onNarration: (listener: NarrationListener) => () => void;
}

type StateUpdater = (patch: Partial<WorkspaceState> | ((prev: WorkspaceState) => Partial<WorkspaceState>)) => void;
type EventEmitter = (evt: ThreadEvent) => void;
type EventUpdater = (id: string, patch: Partial<ThreadEvent>) => void;
type VFSRefresher = () => Promise<void>;

export function useAgentController(
  updateState: StateUpdater,
  addThreadEvent: EventEmitter,
  updateThreadEvent: EventUpdater,
  refreshVFS: VFSRefresher,
): AgentControllerAPI {
  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const listenersRef = useRef<NarrationListener[]>([]);

  const narrate = useCallback(
    (point: NarrationHook["point"], utterance: string, data?: any) => {
      fireNarration(listenersRef.current, createNarrationHook(point, utterance, data));
    },
    [],
  );

  const onNarration = useCallback((listener: NarrationListener) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== listener);
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    runningRef.current = false;
    updateState({ status: "idle", isThinking: false });
    addThreadEvent(createThreadEvent("narration", "Agent stopped", "Execution paused. Workspace state preserved.", { status: "success" }));
  }, [updateState, addThreadEvent]);

  const executeGoal = useCallback(
    async (goal: string) => {
      if (!goal.trim() || runningRef.current) return;
      abortRef.current = false;
      runningRef.current = true;

      // ──────────────────────────────────────────────────────────────────
      // 1. goal.received
      // ──────────────────────────────────────────────────────────────────
      updateState({ goal: goal.trim(), status: "planning", isThinking: true, activeSection: "task", plan: null, researchContext: [] });
      addThreadEvent(createThreadEvent("goal", "goal.received", goal.trim(), { status: "success" }));
      narrate("goal_received", `Got it. "${goal.trim().slice(0, 80)}". Let me plan this out.`, { goal: goal.trim() });

      // ──────────────────────────────────────────────────────────────────
      // 2. Planning — backend first, enhanced client fallback
      // ──────────────────────────────────────────────────────────────────
      const planEvt = createThreadEvent("thinking", "Agent Lee is analyzing your request", "Interpreting goal, selecting tools, building plan…", { status: "running" });
      addThreadEvent(planEvt);

      let actions: ParsedAction[] = [];
      let backendNarration = "";
      let planSource: TaskPlan["source"] = "client";

      try {
        const res = await vmFetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            prompt: `AGENT_WORK_MODE: decompose into steps. Available tools: ${ALL_TOOLS.join(", ")}. Format: BUILD_PLAN::tool:params|tool:params::END_PLAN. Goal: ${goal.trim()}`,
            user_id: "workspace",
            history: [],
          }),
        });
        const data = await res.json();
        const reply = data?.reply || data?.response || data?.message || "";

        const planMatch = reply.match(/BUILD_PLAN::(.+?)::END_PLAN/s);
        if (planMatch) {
          const rawSteps = planMatch[1].split("|").map((s: string) => s.trim()).filter(Boolean);
          for (const raw of rawSteps) {
            const toolMatch = raw.match(/^([a-z_]+):(.+)$/);
            if (toolMatch && ALL_TOOLS.includes(toolMatch[1] as ToolName)) {
              const tool = toolMatch[1] as ToolName;
              const param = toolMatch[2].trim();
              actions.push(act(
                tool,
                tool === "read_file" || tool === "summarize_file" ? { path: param } :
                tool === "run_terminal" ? { cmd: param } :
                tool === "search_web" || tool === "search_workspace" || tool === "search_memory" || tool === "search_logs" ? { query: param } :
                tool === "list_directory" ? { path: param || "/home/agent_lee" } :
                tool === "research" ? { topic: param } :
                tool === "write_file" ? { path: param, content: "" } :
                { ...JSON.parse(param || "{}") },
                `${tool}: ${param.slice(0, 60)}`,
                param,
                1,
              ));
            }
          }
          backendNarration = reply.replace(/BUILD_PLAN::.*?::END_PLAN\n?/s, "").trim();
          if (actions.length > 0) planSource = "backend";
        }

        if (actions.length === 0) backendNarration = reply;
      } catch { /* backend unavailable */ }

      // Client-side fallback — try Digital Life flows first, then general decomposition
      if (actions.length === 0) {
        const dlPlan = detectDigitalLifeFlow(goal);
        if (dlPlan) {
          actions = dlPlan.actions.map(a => ({
            ...a,
            mcpEligible: MCP_ELIGIBLE.has(a.tool),
            maxRetries: a.maxRetries || 1
          }));
          planSource = "client";
          narrate("digital_life_started", `Starting your ${dlPlan.flowType} flow.`, { flowType: dlPlan.flowType });
        } else {
          actions = decomposeGoal(goal);
          planSource = "client";
        }
      }

      if (abortRef.current) { runningRef.current = false; return; }

      // ──────────────────────────────────────────────────────────────────
      // 3. plan.created
      // ──────────────────────────────────────────────────────────────────
      if (actions.length === 0) {
        updateThreadEvent(planEvt.id, { status: "success", content: "No executable steps detected." });
        if (backendNarration) addThreadEvent(createThreadEvent("narration", "Agent Lee", backendNarration, { status: "success" }));
        addThreadEvent(createThreadEvent("complete", "task.completed", "Conversational response — no workspace steps.", { status: "success" }));
        updateState({ status: "idle", isThinking: false });
        runningRef.current = false;
        return;
      }

      const planSteps: PlanStep[] = actions.map((a, i) => ({
        index: i,
        title: a.title,
        description: a.description,
        tool: a.tool,
        status: "pending" as const,
        maxRetries: a.maxRetries,
        retryCount: 0,
        mcpEligible: a.mcpEligible,
      }));

      const plan: TaskPlan = {
        goal: goal.trim(),
        steps: planSteps,
        currentStep: 0,
        estimatedMinutes: Math.max(1, actions.length * 1.5),
        revisionCount: 0,
        source: planSource,
      };

      updateThreadEvent(planEvt.id, { status: "success", content: `${actions.length} steps planned (source: ${planSource})` });
      addThreadEvent(createThreadEvent("plan", "plan.created", `${actions.length} steps · est. ${plan.estimatedMinutes}min · source: ${planSource}\n${planSteps.map((s, i) => `  ${i + 1}. ${s.title}${s.mcpEligible ? " ⚡MCP" : ""}`).join("\n")}`, { status: "success", data: plan }));
      updateState({ plan, activeSection: "plan", isThinking: false });
      narrate("plan_ready", `I've got a ${actions.length}-step plan. Let me execute.`, { stepCount: actions.length });

      if (backendNarration) addThreadEvent(createThreadEvent("narration", "Agent Lee", backendNarration, { status: "success" }));

      // ──────────────────────────────────────────────────────────────────
      // 4. Execute steps with retry/replan capability
      // ──────────────────────────────────────────────────────────────────
      let allSuccess = true;
      const stepResults: ToolResult[] = [];
      let i = 0;

      while (i < actions.length) {
        if (abortRef.current) break;

        const action = actions[i];
        const step = planSteps[i] || {
          index: i,
          title: action.title,
          description: action.description,
          tool: action.tool,
          status: "pending" as const,
          maxRetries: action.maxRetries,
          retryCount: 0,
          mcpEligible: action.mcpEligible,
        };

        // Ensure planSteps is in sync
        if (!planSteps[i]) planSteps.push(step);

        // ── plan.step.started ────────────────────────────────────────
        step.status = "running";
        plan.currentStep = i;
        updateState({ plan: { ...plan, steps: [...planSteps] }, status: "executing", isThinking: true });

        const stepLabel = `Step ${i + 1}/${actions.length}: ${step.title}`;
        addThreadEvent(createThreadEvent("narration", "plan.step.started", stepLabel, {
          status: "running", stepIndex: i, tool: action.tool,
          mcpRouted: action.mcpEligible,
        }));
        narrate("step_started", stepLabel, { stepIndex: i, tool: action.tool });

        // ── Auto-switch tool panel ───────────────────────────────────
        const panel = TOOL_TO_PANEL[action.tool];
        if (panel !== "none") updateState({ activeTool: panel });

        // ── tool.invoked → dispatch (MCP routing is inside dispatcher) ─
        const result = await dispatchTool(action.tool, action.params);
        stepResults.push(result);

        // Emit all events from the dispatcher
        for (const evt of result.events) {
          evt.stepIndex = i;
          evt.mcpRouted = result.mcpRouted;
          addThreadEvent(evt);
        }

        // Accumulate research context
        if (result.success && (action.tool === "research" || action.tool === "search_web" || action.tool === "search_workspace")) {
          updateState((prev) => ({
            researchContext: [...prev.researchContext, result.summary],
          }));
          narrate("research_found", `Found: ${result.summary.slice(0, 80)}`, { tool: action.tool });
        }

        // ── Handle result ────────────────────────────────────────────
        if (result.success) {
          step.status = "done";
          updateState({ plan: { ...plan, steps: [...planSteps] } });
          narrate("step_done", `Step ${i + 1} done: ${step.title}`, { stepIndex: i });

          // Auto-switch to editor for file reads
          if (action.tool === "read_file" && result.data?.path) {
            updateState({ activeTool: "editor", editorFile: result.data.path });
          }
          // Refresh VFS for file writes
          if (action.tool === "write_file") await refreshVFS();

          i++;
        } else {
          // ── RETRY logic ────────────────────────────────────────────
          const maxRetries = action.maxRetries || 0;
          step.retryCount = (step.retryCount || 0) + 1;

          if (step.retryCount <= maxRetries) {
            step.status = "retrying";
            updateState({ plan: { ...plan, steps: [...planSteps] } });

            addThreadEvent(createThreadEvent("narration", "Retrying step",
              `Step ${i + 1} failed (attempt ${step.retryCount}/${maxRetries + 1}). Retrying…`,
              { status: "running", stepIndex: i, retryAttempt: step.retryCount },
            ));

            await new Promise((r) => setTimeout(r, 1000)); // Brief pause before retry
            continue; // Re-execute same step
          }

          // ── REPLAN logic ───────────────────────────────────────────
          step.status = "error";
          narrate("step_failed", `Step ${i + 1} failed: ${result.summary}`, { stepIndex: i });

          // Can we replan?
          const remainingActions = actions.slice(i + 1);
          const recoveryActions = replanForFailure(step, result, remainingActions, goal);

          if (recoveryActions.length > remainingActions.length) {
            // Recovery added new steps — insert them
            plan.revisionCount = (plan.revisionCount || 0) + 1;

            addThreadEvent(createThreadEvent("replan", "Replanning after failure",
              `Step ${i + 1} failed. Adding ${recoveryActions.length - remainingActions.length} recovery step(s). Plan revision #${plan.revisionCount}.`,
              { status: "running", stepIndex: i },
            ));
            narrate("replan_triggered", `Replanning. Added recovery steps.`, { revision: plan.revisionCount });

            // Replace remaining actions with recovery actions
            actions.splice(i + 1, actions.length, ...recoveryActions);

            // Update plan steps
            const newSteps = recoveryActions.map((a, j) => ({
              index: i + 1 + j,
              title: a.title,
              description: a.description,
              tool: a.tool,
              status: "pending" as const,
              maxRetries: a.maxRetries,
              retryCount: 0,
              mcpEligible: a.mcpEligible,
              replanNote: j < (recoveryActions.length - remainingActions.length)
                ? `Recovery step (plan revision #${plan.revisionCount})`
                : undefined,
            }));

            planSteps.splice(i + 1, planSteps.length, ...newSteps);
            plan.source = "replan";
            updateState({ plan: { ...plan, steps: [...planSteps] }, status: "replanning" });

            // Mark as partially failed but continue
            allSuccess = false;
            i++;
          } else {
            // No recovery possible — mark remaining as skipped
            allSuccess = false;
            addThreadEvent(createThreadEvent("verify", "verification.failed",
              `Step ${i + 1} failed: ${result.summary}. No recovery strategy available.`,
              { status: "error", stepIndex: i, verification: result.verification },
            ));

            for (let j = i + 1; j < planSteps.length; j++) {
              planSteps[j].status = "skipped";
            }
            updateState({ plan: { ...plan, steps: [...planSteps] } });
            break;
          }
        }

        // Pause between steps
        if (i < actions.length && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (abortRef.current) { runningRef.current = false; return; }

      // ──────────────────────────────────────────────────────────────────
      // 5. task.completed
      // ──────────────────────────────────────────────────────────────────
      const done = planSteps.filter((s) => s.status === "done").length;
      const failed = planSteps.filter((s) => s.status === "error").length;
      const retried = planSteps.filter((s) => (s.retryCount || 0) > 0).length;
      const replans = plan.revisionCount || 0;

      const parts: string[] = [`${done}/${planSteps.length} steps completed`];
      if (failed > 0) parts.push(`${failed} failed`);
      if (retried > 0) parts.push(`${retried} retried`);
      if (replans > 0) parts.push(`${replans} replan(s)`);

      const verLines = stepResults.map(
        (r, idx) => `  ${r.success ? "✓" : "✗"} Step ${idx + 1}: ${r.verification.evidence}${r.mcpRouted ? " [MCP]" : ""}`,
      );

      updateState({ status: allSuccess ? "complete" : "error", isThinking: false, verificationSummary: verLines.join("\n"), activeTool: "none" });

      addThreadEvent(createThreadEvent("complete", "task.completed",
        `${parts.join(" · ")}\n\nVerification:\n${verLines.join("\n")}`,
        {
          status: allSuccess ? "success" : "error",
          verification: {
            verified: true,
            evidence: allSuccess ? `All ${planSteps.length} steps verified` : `${failed} step(s) failed`,
          },
        },
      ));

      narrate("task_completed", allSuccess ? `All ${planSteps.length} steps verified. Task complete.` : `${done} of ${planSteps.length} steps completed. ${failed} failed.`, { done, failed, replans });

      // Artifact listing
      const artifactPaths = stepResults.filter((r) => r.success && r.data?.path).map((r) => r.data.path as string);
      if (artifactPaths.length > 0) {
        addThreadEvent(createThreadEvent("artifact", "artifact.created", `Workspace artifacts:\n${artifactPaths.map((p) => `  • ${p}`).join("\n")}`, { status: "success" }));
      }

      setTimeout(() => updateState({ status: "idle" }), 2000);
      runningRef.current = false;
    },
    [updateState, addThreadEvent, updateThreadEvent, refreshVFS, narrate],
  );

  return {
    executeGoal,
    stop,
    get isRunning() { return runningRef.current; },
    onNarration,
  };
}
