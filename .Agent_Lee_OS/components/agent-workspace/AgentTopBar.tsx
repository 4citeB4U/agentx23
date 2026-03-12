/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.TOPBAR
LICENSE: MIT
*/

import {
  Activity,
  Check,
  Loader2,
  MessageSquare,
  Pause,
  Shield,
  Square,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import React from "react";
import { AgentStatus, NarrationMode } from "./types";

const STATUS_LABELS: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "text-zinc-500" },
  planning: { label: "Planning…", color: "text-blue-400" },
  researching: { label: "Researching…", color: "text-cyan-400" },
  reading: { label: "Reading…", color: "text-sky-400" },
  executing: { label: "Executing…", color: "text-amber-400" },
  verifying: { label: "Verifying…", color: "text-emerald-400" },
  awaiting_approval: { label: "Awaiting Approval", color: "text-orange-400" },
  replanning: { label: "Replanning…", color: "text-amber-400" },
  finalizing: { label: "Finalizing…", color: "text-purple-400" },
  complete: { label: "Complete", color: "text-green-400" },
  error: { label: "Error", color: "text-red-400" },
};

interface AgentTopBarProps {
  goal: string;
  status: AgentStatus;
  narrationMode: NarrationMode;
  approvalMode: boolean;
  isThinking: boolean;
  backendReady: boolean;
  mcpBridgeOnline: boolean;
  runningJobs: number;
  onSetNarration: (mode: NarrationMode) => void;
  onToggleApproval: () => void;
  onStop: () => void;
}

export const AgentTopBar: React.FC<AgentTopBarProps> = ({
  goal,
  status,
  narrationMode,
  approvalMode,
  isThinking,
  backendReady,
  mcpBridgeOnline,
  runningJobs,
  onSetNarration,
  onToggleApproval,
  onStop,
}) => {
  const statusInfo = STATUS_LABELS[status];

  return (
    <div className="h-12 bg-zinc-950 border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
      {/* Bot avatar */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isThinking
            ? "bg-blue-600 animate-pulse"
            : status === "error"
              ? "bg-red-900"
              : "bg-zinc-800"
        }`}
      >
        <Zap size={14} className="text-white" />
      </div>

      {/* Task title */}
      <div className="flex-grow min-w-0">
        <div className="text-[11px] font-bold text-zinc-100 truncate">
          {goal || "Agent Lee Workspace"}
        </div>
        <div className={`text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5 ${statusInfo.color}`}>
          {isThinking && (
            <Loader2 size={10} className="animate-spin" />
          )}
          {status === "complete" && <Check size={10} />}
          {statusInfo.label}
          {runningJobs > 0 && (
            <span className="text-yellow-500 ml-1">
              · {runningJobs} job{runningJobs > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Backend status */}
        <div
          title={backendReady ? "Backend online" : "Backend offline"}
          className={`p-1.5 rounded ${backendReady ? "text-emerald-500" : "text-red-500"}`}
        >
          {backendReady ? <Wifi size={12} /> : <WifiOff size={12} />}
        </div>

        {/* MCP status */}
        <div
          title={mcpBridgeOnline ? "MCP Bridge online" : "MCP Bridge offline"}
          className={`p-1.5 rounded ${mcpBridgeOnline ? "text-emerald-500" : "text-zinc-600"}`}
        >
          <Activity size={12} />
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/5" />

        {/* Narration mode toggle */}
        <button
          onClick={() => {
            const modes: NarrationMode[] = [
              "silent",
              "guided",
              "full",
              "conversational",
            ];
            const idx = modes.indexOf(narrationMode);
            onSetNarration(modes[(idx + 1) % modes.length]);
          }}
          title={`Narration: ${narrationMode}`}
          className={`p-1.5 rounded transition-colors ${
            narrationMode === "silent"
              ? "text-zinc-600 hover:text-zinc-400"
              : "text-blue-400 hover:text-blue-300"
          }`}
        >
          {narrationMode === "silent" ? (
            <VolumeX size={14} />
          ) : narrationMode === "conversational" ? (
            <MessageSquare size={14} />
          ) : (
            <Volume2 size={14} />
          )}
        </button>

        {/* Approval mode */}
        <button
          onClick={onToggleApproval}
          title={
            approvalMode
              ? "Approval mode ON — mutations require approval"
              : "Approval mode OFF — auto-apply enabled"
          }
          className={`p-1.5 rounded transition-colors ${
            approvalMode
              ? "text-orange-400 hover:text-orange-300"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          <Shield size={14} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/5" />

        {/* Stop / pause */}
        {isThinking && (
          <button
            onClick={onStop}
            title="Stop agent"
            className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <Square size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
