/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.MAIN

5WH:
WHAT = LeeAgentWorkspace main shell (Phase 3 — Agent Controller + MCP)
WHY = Real agent workflow: goal → plan → auto-execute → verify → complete
WHO = LEEWAY / Agent Workspace Rewrite
WHERE = .Agent_Lee_OS/components/agent-workspace/LeeAgentWorkspace.tsx
WHEN = 2026
HOW = Three-panel layout driven by useAgentController

DISCOVERY_PIPELINE: Voice → Intent → Location → Vertical → Ranking → Render

LICENSE:
MIT
*/

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ConversationThread } from "./agent-mode/ConversationThread";
import { useAgentController } from "./useAgentController";
import { getLeewayStatus } from "./leewayBridge";
import { getNarrationEngine } from "./narrationEngine";
import {
  ActiveTool,
  NarrationMode,
  SidebarSection,
  ThreadEvent,
  VFSDirectory,
  WorkspaceState,
  createInitialState,
  createThreadEvent,
} from "./types";
import { readFile as dispatchReadFile, runTerminal as dispatchRunTerminal } from "./toolDispatcher";

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

// ── Main Workspace Component ───────────────────────────────────────────────
export const LeeAgentWorkspace: React.FC = () => {
  const [state, setState] = useState<WorkspaceState>(createInitialState());
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [goalInput, setGoalInput] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── State helpers ──────────────────────────────────────────────────────
  const updateState = useCallback(
    (patchOrFn: Partial<WorkspaceState> | ((prev: WorkspaceState) => Partial<WorkspaceState>)) => {
      setState((prev) => {
        const patch = typeof patchOrFn === "function" ? patchOrFn(prev) : patchOrFn;
        return { ...prev, ...patch };
      });
    },
    [],
  );

  const addThreadEvent = useCallback(
    (evt: ThreadEvent) => {
      setState((prev) => ({
        ...prev,
        thread: [...prev.thread, evt],
      }));
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    [],
  );

  const updateThreadEvent = useCallback(
    (id: string, patch: Partial<ThreadEvent>) => {
      setState((prev) => ({
        ...prev,
        thread: prev.thread.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
      }));
    },
    [],
  );

  // ── VFS refresh ────────────────────────────────────────────────────────
  const fetchVFS = useCallback(async () => {
    try {
      const r = await vmFetch("/api/vm/vfs?path=/");
      if (r.ok) {
        const vfs = (await r.json()) as VFSDirectory;
        updateState({ vfs });
      }
    } catch { /* use fallback */ }
  }, [updateState]);

  // ── Backend status polling ─────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const r = await vmFetch("/api/vm/status");
      if (r.ok) {
        const data = await r.json();
        updateState({
          runningJobs: data.runningJobs || 0,
          backendReady: true,
        });
      }
    } catch {
      updateState({ backendReady: false });
    }
  }, [updateState]);

  const checkMCPBridge = useCallback(async () => {
    try {
      const r = await fetch("/api/mcp/status");
      updateState({ mcpBridgeOnline: r.ok });
    } catch {
      updateState({ mcpBridgeOnline: false });
    }
  }, [updateState]);

  // ── Agent Controller (Phase 2 brain) ───────────────────────────────────
  const controller = useAgentController(
    updateState,
    addThreadEvent,
    updateThreadEvent,
    fetchVFS,
  );

  useEffect(() => {
    fetchStatus();
    fetchVFS();
    checkMCPBridge();
    const id = setInterval(() => {
      fetchStatus();
      checkMCPBridge();
      // Also poll leeway status
      getLeewayStatus().then(ls => updateState({ 
        leewayStatus: {
          online: ls.healthy,
          version: ls.sdkVersion,
          score: ls.complianceScore,
          level: ls.complianceLevel
        }
      }));
    }, 8000);
    return () => clearInterval(id);
  }, [fetchStatus, fetchVFS, checkMCPBridge, updateState]);

  // ── Narration Wiring ──────────────────────────────────────────────────
  useEffect(() => {
    const engine = getNarrationEngine();
    engine.setMode(state.narrationMode);
    engine.setEnabled(state.ttsEnabled);

    const unregister = controller.onNarration(engine.getListener());
    return unregister;
  }, [controller, state.narrationMode, state.ttsEnabled]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Goal submission → delegates to controller ─────────────────────────
  const submitGoal = useCallback(
    async (goal: string) => {
      if (!goal.trim()) return;
      await controller.executeGoal(goal);
    },
    [controller],
  );

  // ── Manual tool actions (from thread cards or tool panel) ──────────────
  const handleManualCommand = useCallback(
    async (cmd: string) => {
      updateState({ activeTool: "terminal", status: "executing", isThinking: true });
      const result = await dispatchRunTerminal(cmd);
      for (const evt of result.events) addThreadEvent(evt);
      updateState({ status: "idle", isThinking: false });
    },
    [addThreadEvent, updateState],
  );

  const handleManualReadFile = useCallback(
    async (filePath: string) => {
      updateState({ activeTool: "editor", status: "reading", isThinking: true });
      const result = await dispatchReadFile(filePath);
      for (const evt of result.events) addThreadEvent(evt);
      if (result.success && result.data?.path) {
        updateState({ editorFile: result.data.path });
      }
      updateState({ status: "idle", isThinking: false });
    },
    [addThreadEvent, updateState],
  );

  // ── Approval handling ─────────────────────────────────────────────────
  const handleApproval = useCallback(
    (eventId: string, approved: boolean) => {
      updateThreadEvent(eventId, {
        approvalState: approved ? "approved" : "denied",
        status: approved ? "success" : "error",
        content: approved ? "Approved by user" : "Denied by user",
      });
      setState((prev) => ({
        ...prev,
        status: approved ? "executing" : "idle",
        approvals: prev.approvals.filter((a) => a.id !== eventId),
      }));
      if (approved) {
        setState((prev) => {
          const evt = prev.thread.find((e) => e.id === eventId);
          if (evt?.data?.onApprove) evt.data.onApprove();
          return prev;
        });
      }
    },
    [updateThreadEvent],
  );

  // ── Section/tool navigation ────────────────────────────────────────────
  const setSection = useCallback(
    (section: SidebarSection) => {
      updateState({ activeSection: section });
      const toolMap: Partial<Record<SidebarSection, ActiveTool>> = {
        terminal: "terminal",
        browser: "browser",
        files: "files",
      };
      if (toolMap[section]) {
        updateState({ activeTool: toolMap[section]! });
      }
    },
    [updateState],
  );

  const setActiveTool = useCallback(
    (tool: ActiveTool) => updateState({ activeTool: tool }),
    [updateState],
  );

  const setNarrationMode = useCallback(
    (mode: NarrationMode) => updateState({ narrationMode: mode }),
    [updateState],
  );

  const toggleApprovalMode = useCallback(
    () => {
      setState((prev) => ({ ...prev, approvalMode: !prev.approvalMode }));
    },
    [],
  );

  const stopAgent = useCallback(() => {
    controller.stop();
  }, [controller]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full w-full flex flex-col bg-[#0f0f13] text-zinc-200 overflow-hidden font-sans relative">
      
      {/* Optional Compact Status Header */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="flex justify-between items-center px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 pointer-events-auto bg-[#1a1a1f] border border-white/10 rounded-full px-3 py-1.5 shadow-md">
            <div className={`w-2 h-2 rounded-full ${state.backendReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500"}`} />
            <span className="text-[11px] font-semibold text-zinc-300">Agent Lee</span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto bg-[#1a1a1f] border border-white/10 rounded-full px-3 py-1.5 shadow-md">
            {state.isThinking || state.status === "executing" || state.status === "replanning" ? (
              <span className="text-[11px] text-blue-400 font-medium flex items-center gap-2">
                <span className="animate-pulse">●</span> Working
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500 font-medium">Idle</span>
            )}
            <button onClick={stopAgent} className="ml-2 text-zinc-400 hover:text-red-400">
              <span className="text-[10px] font-bold uppercase">Stop</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Conversation Thread */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        <ConversationThread
          thread={state.thread}
          status={state.status}
          isThinking={state.isThinking}
          plan={state.plan}
          onApproval={handleApproval}
          onOpenFile={handleManualReadFile}
          threadEndRef={threadEndRef}
        />
      </div>

      {/* ChatGPT-style Input Bar */}
      <div className="shrink-0 pt-4 pb-6 px-4 sm:px-8 bg-gradient-to-t from-[#0f0f13] via-[#0f0f13] to-transparent absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto relative">
          <div className="bg-[#2f2f35] border border-white/10 rounded-2xl shadow-lg focus-within:border-white/20 transition-all flex items-end">
            <textarea
              className="flex-grow bg-transparent text-zinc-100 placeholder-zinc-500 px-5 py-4 min-h-[56px] max-h-48 resize-none outline-none text-[15px] leading-relaxed"
              placeholder={state.isThinking ? "Agent Lee is working..." : "Message Agent Lee..."}
              disabled={state.isThinking}
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (goalInput.trim()) {
                    submitGoal(goalInput);
                    setGoalInput("");
                  }
                }
              }}
              rows={1}
            />
            <div className="px-3 pb-3">
              <button
                onClick={() => {
                  if (goalInput.trim()) {
                    submitGoal(goalInput);
                    setGoalInput("");
                  }
                }}
                disabled={!goalInput.trim() || state.isThinking}
                className="p-2.5 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl transition-colors"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="M12 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
          <div className="text-center mt-2 text-[11px] text-zinc-600 font-medium">
            Agent Lee can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeeAgentWorkspace;
