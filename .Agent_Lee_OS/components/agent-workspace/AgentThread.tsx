/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.THREAD
LICENSE: MIT

PHASE 2: Thread is source-of-truth event timeline.
         Shows live plan progress, structured events, and workspace-first language.
*/

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Database,
  Eye,
  FileText,
  Flag,
  Globe,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  Search,
  Send,
  Shield,
  SkipForward,
  Smartphone,
  Target,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import {
  AgentStatus,
  Artifact,
  PlanStep,
  SidebarSection,
  TaskPlan,
  ThreadEvent,
  ThreadEventType,
} from "./types";

// ── Thread Card Icon + Color Map ───────────────────────────────────────────
const EVENT_STYLES: Record<
  ThreadEventType,
  { icon: React.ReactNode; borderColor: string; bgColor: string }
> = {
  goal: {
    icon: <Target size={14} />,
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/5",
  },
  plan: {
    icon: <BookOpen size={14} />,
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/5",
  },
  search: {
    icon: <Search size={14} />,
    borderColor: "border-cyan-500/30",
    bgColor: "bg-cyan-500/5",
  },
  read_file: {
    icon: <FileText size={14} />,
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/5",
  },
  write_file: {
    icon: <Code size={14} />,
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-500/5",
  },
  command: {
    icon: <Terminal size={14} />,
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/5",
  },
  build: {
    icon: <Wrench size={14} />,
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/5",
  },
  test: {
    icon: <Shield size={14} />,
    borderColor: "border-teal-500/30",
    bgColor: "bg-teal-500/5",
  },
  verify: {
    icon: <CheckCircle size={14} />,
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/5",
  },
  approval: {
    icon: <Lock size={14} />,
    borderColor: "border-orange-500/40",
    bgColor: "bg-orange-500/8",
  },
  artifact: {
    icon: <Package size={14} />,
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/5",
  },
  narration: {
    icon: <Zap size={14} />,
    borderColor: "border-zinc-500/20",
    bgColor: "bg-zinc-800/50",
  },
  error: {
    icon: <AlertCircle size={14} />,
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/5",
  },
  mcp_dispatch: {
    icon: <Zap size={14} />,
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/5",
  },
  complete: {
    icon: <Trophy size={14} />,
    borderColor: "border-green-500/40",
    bgColor: "bg-green-500/8",
  },
  thinking: {
    icon: <Loader2 size={14} className="animate-spin" />,
    borderColor: "border-blue-500/20",
    bgColor: "bg-blue-500/5",
  },
  user_message: {
    icon: <ArrowRight size={14} />,
    borderColor: "border-zinc-500/20",
    bgColor: "bg-zinc-800/30",
  },
  // Phase 3 additions
  research: {
    icon: <Globe size={14} />,
    borderColor: "border-teal-500/30",
    bgColor: "bg-teal-500/5",
  },
  replan: {
    icon: <RefreshCw size={14} />,
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/8",
  },
  device: {
    icon: <Smartphone size={14} />,
    borderColor: "border-pink-500/30",
    bgColor: "bg-pink-500/5",
  },
  retrieval: {
    icon: <Database size={14} />,
    borderColor: "border-lime-500/30",
    bgColor: "bg-lime-500/5",
  },
  summarize: {
    icon: <FileText size={14} />,
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/5",
  },
};

// ── Step Status Icon ───────────────────────────────────────────────────────
function StepStatusIcon({ status }: { status: PlanStep["status"] }) {
  switch (status) {
    case "done":
      return <Check size={10} className="text-white" />;
    case "running":
      return <Loader2 size={10} className="animate-spin text-white" />;
    case "retrying":
      return <RefreshCw size={10} className="animate-spin text-white" />;
    case "error":
      return <XCircle size={10} className="text-white" />;
    case "skipped":
      return <SkipForward size={10} className="text-white" />;
    default:
      return null;
  }
}

function stepBgColor(status: PlanStep["status"]): string {
  switch (status) {
    case "done":
      return "bg-emerald-600";
    case "running":
      return "bg-blue-600 animate-pulse";
    case "retrying":
      return "bg-amber-600 animate-pulse";
    case "error":
      return "bg-red-600";
    case "skipped":
      return "bg-zinc-700";
    default:
      return "bg-zinc-800";
  }
}

// ── Live Plan Progress Bar ────────────────────────────────────────────────
const PlanProgress: React.FC<{ plan: TaskPlan }> = ({ plan }) => {
  const done = plan.steps.filter((s) => s.status === "done").length;
  const failed = plan.steps.filter((s) => s.status === "error").length;
  const skipped = plan.steps.filter((s) => s.status === "skipped").length;
  const total = plan.steps.length;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : "0";
  const isActive = plan.steps.some((s) => s.status === "running");

  return (
    <div className="border border-purple-500/20 bg-purple-500/5 rounded-xl p-3 mb-2.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flag size={12} className="text-purple-400" />
          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
            Execution Plan
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-emerald-500">{done} done</span>
          {failed > 0 && <span className="text-red-400">{failed} failed</span>}
          {skipped > 0 && <span className="text-zinc-600">{skipped} skipped</span>}
          <span className="text-zinc-600">/ {total}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed > 0 ? "bg-red-500" : "bg-emerald-500"
          } ${isActive ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step list */}
      <div className="space-y-1">
        {plan.steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-[10px] px-1 py-0.5 rounded ${
              step.status === "running" ? "bg-blue-500/10" : ""
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${stepBgColor(step.status)} ${
                step.status === "pending" ? "text-zinc-500" : "text-white"
              }`}
            >
              {step.status === "pending" ? (
                i + 1
              ) : (
                <StepStatusIcon status={step.status} />
              )}
            </span>
            <span
              className={`flex-grow ${
                step.status === "done"
                  ? "text-zinc-600 line-through"
                  : step.status === "running"
                    ? "text-blue-300 font-semibold"
                    : step.status === "error"
                      ? "text-red-400"
                      : step.status === "skipped"
                        ? "text-zinc-600 italic"
                        : "text-zinc-400"
              }`}
            >
              {step.title}
            </span>
            {step.tool && (
              <span className="text-[7px] bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded font-mono uppercase shrink-0">
                {step.tool}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Single Thread Card ─────────────────────────────────────────────────────
const ThreadCard: React.FC<{
  event: ThreadEvent;
  onApproval?: (id: string, approved: boolean) => void;
  onOpenFile?: (path: string) => void;
  onRunCommand?: (cmd: string) => void;
}> = ({ event, onApproval, onOpenFile, onRunCommand }) => {
  const [expanded, setExpanded] = useState(false);
  const style = EVENT_STYLES[event.type] || EVENT_STYLES.narration;

  const statusIcon =
    event.status === "running" ? (
      <Loader2 size={10} className="animate-spin text-blue-400" />
    ) : event.status === "success" ? (
      <Check size={10} className="text-emerald-400" />
    ) : event.status === "error" ? (
      <XCircle size={10} className="text-red-400" />
    ) : event.status === "approval_needed" ? (
      <Lock size={10} className="text-orange-400" />
    ) : (
      <Clock size={10} className="text-zinc-600" />
    );

  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Determine if this is a step-level event (render more compactly)
  const isStepEvent = event.stepIndex != null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`border rounded-xl ${isStepEvent ? "p-2 ml-4" : "p-3"} ${style.borderColor} ${style.bgColor} transition-all`}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        {/* Step index badge */}
        {isStepEvent && (
          <span className="text-[8px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold mt-0.5 shrink-0">
            S{(event.stepIndex ?? 0) + 1}
          </span>
        )}
        <div className="mt-0.5 shrink-0 text-zinc-400">{style.icon}</div>
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${isStepEvent ? "text-[10px]" : "text-[11px]"} font-bold text-zinc-200 truncate`}>
              {event.title}
            </span>
            {statusIcon}
            {event.tool && (
              <span className="text-[7px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono uppercase">
                {event.tool}
              </span>
            )}
            {event.mcpRouted && (
              <span className="text-[7px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                ⚡MCP
              </span>
            )}
            {event.retryAttempt != null && event.retryAttempt > 0 && (
              <span className="text-[7px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                retry #{event.retryAttempt}
              </span>
            )}
            {event.agent && (
              <span className="text-[7px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded font-mono">
                {event.agent}
              </span>
            )}
          </div>
          <div className={`${isStepEvent ? "text-[9px]" : "text-[10px]"} text-zinc-500 mt-0.5 leading-relaxed whitespace-pre-wrap`}>
            {event.content.length > 400 && !expanded
              ? event.content.slice(0, 400) + "…"
              : event.content}
            {event.content.length > 400 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-blue-400 hover:text-blue-300 ml-1"
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </div>
        </div>
        <span className="text-[8px] text-zinc-700 font-mono shrink-0">
          {time}
        </span>
      </div>

      {/* Verification badge */}
      {event.verification && (
        <div className={`mt-2 flex items-center gap-1.5 text-[9px] ${isStepEvent ? "px-5" : "px-7"}`}>
          {event.verification.verified ? (
            event.status === "error" ? (
              <>
                <XCircle size={10} className="text-red-500" />
                <span className="text-red-400 font-bold uppercase">Failed</span>
                <span className="text-zinc-600">{event.verification.evidence}</span>
              </>
            ) : (
              <>
                <CheckCircle size={10} className="text-emerald-500" />
                <span className="text-emerald-500 font-bold uppercase">Verified</span>
                <span className="text-zinc-600">{event.verification.evidence}</span>
              </>
            )
          ) : (
            <>
              <AlertCircle size={10} className="text-yellow-500" />
              <span className="text-yellow-500 font-bold uppercase">Unverified</span>
            </>
          )}
        </div>
      )}

      {/* Command output expandable */}
      {event.type === "command" && event.data?.output && (
        <div className={`mt-2 ${isStepEvent ? "px-5" : "px-7"}`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? "Hide output" : `Show output (${event.data.output.length} chars)`}
          </button>
          {expanded && (
            <pre className="mt-1 text-[10px] text-green-300/80 bg-black/40 p-2 rounded-lg overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
              {event.data.output}
            </pre>
          )}
        </div>
      )}

      {/* Search results summary */}
      {event.type === "search" && event.data?.results && event.status === "success" && (
        <div className={`mt-2 ${isStepEvent ? "px-5" : "px-7"} space-y-1`}>
          {event.data.results.slice(0, 3).map((r: any, i: number) => (
            <div key={i} className="text-[9px] text-zinc-500">
              <span className="text-blue-400">{r.title?.slice(0, 60)}</span>
              {r.snippet && <span className="text-zinc-600 ml-1">— {r.snippet.slice(0, 80)}</span>}
            </div>
          ))}
          {event.data.results.length > 3 && (
            <span className="text-[8px] text-zinc-600">
              +{event.data.results.length - 3} more results
            </span>
          )}
        </div>
      )}

      {/* Plan steps (for plan.created events) */}
      {event.type === "plan" && event.data?.steps && (
        <div className={`mt-2 ${isStepEvent ? "px-5" : "px-7"} space-y-1`}>
          {event.data.steps.map((step: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-2 text-[10px] text-zinc-400"
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${stepBgColor(step.status)} ${
                  step.status === "pending" ? "text-zinc-500" : "text-white"
                }`}
              >
                {step.status === "pending" ? (
                  i + 1
                ) : (
                  <StepStatusIcon status={step.status} />
                )}
              </span>
              <span
                className={
                  step.status === "done" ? "line-through opacity-50" : ""
                }
              >
                {step.title}
              </span>
              {step.tool && (
                <span className="text-[7px] bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded font-mono uppercase">
                  {step.tool}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approval buttons */}
      {event.type === "approval" &&
        event.approvalState === "pending" &&
        onApproval && (
          <div className="mt-3 px-7 flex items-center gap-2">
            <button
              onClick={() => onApproval(event.id, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-colors"
            >
              <ThumbsUp size={12} />
              Approve
            </button>
            <button
              onClick={() => onApproval(event.id, false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded-lg transition-colors"
            >
              <ThumbsDown size={12} />
              Deny
            </button>
          </div>
        )}

      {/* File link */}
      {event.type === "read_file" &&
        event.data?.path &&
        event.status === "success" &&
        onOpenFile && (
          <div className={`mt-2 ${isStepEvent ? "px-5" : "px-7"}`}>
            <button
              onClick={() => onOpenFile(event.data.path)}
              className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <Eye size={10} />
              Open in editor
            </button>
          </div>
        )}

      {/* Completion event — special styling */}
      {event.type === "complete" && event.status === "success" && (
        <div className="mt-2 px-7 py-1.5 bg-green-500/5 rounded-lg border border-green-500/20">
          <div className="flex items-center gap-1.5 text-[9px] text-green-400 font-bold uppercase">
            <Trophy size={12} />
            Task Complete — All Steps Verified
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ── Agent Thread ─────────────────────────────────────────────────────────
interface AgentThreadProps {
  thread: ThreadEvent[];
  status: AgentStatus;
  isThinking: boolean;
  plan: TaskPlan | null;
  goalInput: string;
  onGoalInputChange: (v: string) => void;
  onSubmitGoal: (goal: string) => void;
  onApproval: (id: string, approved: boolean) => void;
  onOpenFile: (path: string) => void;
  onRunCommand: (cmd: string) => void;
  threadEndRef: React.RefObject<HTMLDivElement>;
  activeSection: SidebarSection;
  artifacts: Artifact[];
}

export const AgentThread: React.FC<AgentThreadProps> = ({
  thread,
  status,
  isThinking,
  plan,
  goalInput,
  onGoalInputChange,
  onSubmitGoal,
  onApproval,
  onOpenFile,
  onRunCommand,
  threadEndRef,
  activeSection,
  artifacts,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Thread content */}
      <div className="flex-grow overflow-y-auto">
        {thread.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-4">
              <Zap size={28} className="text-blue-500" />
            </div>
            <h2 className="text-lg font-bold text-zinc-200 mb-1">
              Agent Lee Workspace
            </h2>
            <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed mb-1">
              Tell Agent Lee what you need. He'll plan the work, execute each
              step, verify results, and ask for approval before touching
              anything outside his workspace.
            </p>
            <p className="text-[9px] text-zinc-700 max-w-sm leading-relaxed">
              Multi-step goals are decomposed into a visible plan. Each step
              shows the tool used, the result, and verification evidence.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-[10px] text-zinc-600 max-w-md w-full">
              {[
                "Inspect the workspace, search for the build issue, fix it, rerun the build, and summarize the result",
                "Research React server components and create a summary",
                "Search workspace for errors, check logs, and report findings",
                "Read package.json, run npm build, and report issues",
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => onSubmitGoal(ex)}
                  className="p-2.5 border border-white/5 rounded-xl hover:bg-white/3 hover:border-white/10 hover:text-zinc-400 transition-all text-left"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Thread cards + live plan */
          <div className="p-4 space-y-2.5">
            {/* Live plan progress (sticky) */}
            {plan && plan.steps.some((s) => s.status === "running" || s.status === "done") && (
              <div className="sticky top-0 z-10">
                <PlanProgress plan={plan} />
              </div>
            )}

            <AnimatePresence initial={false}>
              {thread.map((evt) => (
                <ThreadCard
                  key={evt.id}
                  event={evt}
                  onApproval={onApproval}
                  onOpenFile={onOpenFile}
                  onRunCommand={onRunCommand}
                />
              ))}
            </AnimatePresence>
            <div ref={threadEndRef as any} />
          </div>
        )}
      </div>

      {/* Input bar — always at bottom */}
      <div className="shrink-0 border-t border-white/5 bg-zinc-950 p-3">
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 focus-within:border-blue-500/30 transition-colors">
          <input
            value={goalInput}
            onChange={(e) => onGoalInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && goalInput.trim()) {
                onSubmitGoal(goalInput);
              }
            }}
            placeholder={
              isThinking
                ? "Agent Lee is working…"
                : "Tell Agent Lee what to do…"
            }
            disabled={isThinking}
            className="flex-grow bg-transparent outline-none text-[12px] text-zinc-200 placeholder-zinc-600 disabled:opacity-50"
          />
          <button
            onClick={() => {
              if (goalInput.trim()) onSubmitGoal(goalInput);
            }}
            disabled={!goalInput.trim() || isThinking}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 px-1">
          <span className="text-[8px] text-zinc-700 font-mono uppercase tracking-widest">
            Workspace-First Policy
          </span>
          <span className="text-[8px] text-zinc-700">·</span>
          <span className="text-[8px] text-zinc-700 font-mono uppercase tracking-widest">
            All changes sandboxed until approved
          </span>
          {plan && (
            <>
              <span className="text-[8px] text-zinc-700">·</span>
              <span className="text-[8px] text-blue-700 font-mono uppercase tracking-widest">
                Plan: {plan.steps.filter((s) => s.status === "done").length}/{plan.steps.length} steps
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
