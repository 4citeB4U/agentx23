/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.DIAGNOSTICSPANEL.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = DiagnosticsPanel module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\DiagnosticsPanel.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — Diagnostics Panel ─────────────────────────────────────────

import { Activity, Clock, Pause, Play, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { DeployedApp, STATUS_COLOR } from "./appTypes";
import { formatUptime, usePolledMetrics } from "./useAppMetrics";

interface Props {
  app: DeployedApp;
  onClose: () => void;
  onUpdate: (updated: DeployedApp) => void;
  onDelete: (id: string) => void;
}

export const DiagnosticsPanel: React.FC<Props> = ({
  app,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [paused, setPaused] = useState(false);
  const { history, latest } = usePolledMetrics(app.id, paused);
  const color = STATUS_COLOR[app.status];

  // Prefer live data, fall back to initial app.metrics
  const m = latest ?? app.metrics;

  // MCP/Agent diagnostics
  const [mcpStatus, setMcpStatus] = useState<Record<string, any> | null>(null);
  const [mcpLogs, setMcpLogs] = useState<Record<string, string[]> | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<Record<
    string,
    boolean
  > | null>(null);

  useEffect(() => {
    // Fetch MCP status
    fetch("/api/mcp/status")
      .then((r) => r.json())
      .then((data) => setMcpStatus(data?.data?.modules || {}));
    // Fetch pipeline status
    fetch("/api/system/pipeline-status")
      .then((r) => r.json())
      .then((data) => setPipelineStatus(data));
  }, []);

  const handleFixMcp = (name: string) => {
    fetch(`/api/mcp/start/${name}`, { method: "POST" })
      .then(() => fetch("/api/mcp/status"))
      .then((r) => r.json())
      .then((data) => setMcpStatus(data?.data?.modules || {}));
  };
  const handleFetchLogs = (name: string) => {
    fetch(`/api/mcp/logs/${name}?tail=60`)
      .then((r) => r.json())
      .then((data) =>
        setMcpLogs((prev) => ({ ...prev, [name]: data?.data?.logs || [] })),
      );
  };
  const handleFixPipeline = (key: string) => {
    fetch(`/api/system/fix-pipeline/${key}`, { method: "POST" })
      .then(() => fetch("/api/system/pipeline-status"))
      .then((r) => r.json())
      .then((data) => setPipelineStatus(data));
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full shrink-0 status-indicator`}
          title="Status indicator"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base truncate">
            {app.name}
          </h3>
          <p className="text-white/40 text-[10px] font-mono">{app.subdomain}</p>
        </div>
        {/* Pause / Resume */}
        <button
          title="Open Diagnostics Panel"
          onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-1.5 rounded-xl bg-white/6 border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          <span className="hidden sm:inline">
            {paused ? "Resume" : "Pause"}
          </span>
        </button>
        {/* Close */}
        <button
          onClick={onClose}
          className="rounded-xl bg-white/6 border border-white/10 p-2 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          title="Close diagnostics panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* MCP/Agent Diagnostics */}
      <div className="space-y-2">
        <h4 className="text-white/80 font-bold text-sm">Agent Diagnostics</h4>
        {mcpStatus &&
          Object.entries(mcpStatus).map(([name, status]) => (
            <div
              key={name}
              className="flex items-center gap-2 border border-slate-700 rounded-lg p-2 bg-slate-900/30"
            >
              <span className="font-mono text-xs text-slate-200">{name}</span>
              <span className="text-xs font-bold text-slate-300">
                {status.running ? "RUNNING" : "STOPPED"}
              </span>
              {status.lastError && (
                <span className="text-xs text-red-400">{status.lastError}</span>
              )}
              <button
                onClick={() => handleFixMcp(name)}
                className="px-2 py-1 rounded bg-emerald-700/20 text-emerald-300 text-xs font-bold"
                title={`Fix agent ${name}`}
              >
                Fix
              </button>
              <button
                onClick={() => handleFetchLogs(name)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 text-xs font-bold"
                title={`Show logs for agent ${name}`}
              >
                Logs
              </button>
              {mcpLogs && mcpLogs[name] && (
                <div className="bg-black/30 border border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {mcpLogs[name].slice(-60).join("\n")}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Pipeline Diagnostics */}
      <div className="space-y-2 mt-4">
        <h4 className="text-white/80 font-bold text-sm">
          Intelligence Pipeline
        </h4>
        {pipelineStatus &&
          Object.entries(pipelineStatus).map(([key, connected]) => (
            <div
              key={key}
              className="flex items-center gap-2 border border-slate-700 rounded-lg p-2 bg-slate-900/30"
            >
              <span className="font-mono text-xs text-slate-200">{key}</span>
              <span className="text-xs font-bold text-slate-300">
                {connected ? "CONNECTED" : "NOT CONNECTED"}
              </span>
              <button
                onClick={() => handleFixPipeline(key)}
                className="px-2 py-1 rounded bg-emerald-700/20 text-emerald-300 text-xs font-bold"
                title={`Fix pipeline ${key}`}
              >
                Fix
              </button>
            </div>
          ))}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          {
            label: "Uptime",
            val: formatUptime(m.uptime),
            icon: <Clock size={11} />,
          },
          {
            label: "CPU",
            val: `${m.cpu.toFixed(1)}%`,
            icon: <Activity size={11} />,
          },
          {
            label: "Memory",
            val: `${m.memory.toFixed(1)}%`,
            icon: <Activity size={11} />,
          },
          { label: "RPS", val: String(m.rps), icon: <Activity size={11} /> },
          {
            label: "P95",
            val: `${m.latencyP95}ms`,
            icon: <Activity size={11} />,
          },
          {
            label: "Errors",
            val: `${m.errorRate.toFixed(2)}%`,
            icon: <Activity size={11} />,
          },
        ].map(({ label, val, icon }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-xl bg-white/4 border border-white/6 p-2"
          >
            <div className="flex items-center gap-1 text-white/30">
              {icon}
              <span>{label}</span>
            </div>
            <div className="text-white font-mono text-xs">{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; val: number | string; unit: string }> = ({
  label,
  val,
  unit,
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] font-mono text-white/30 uppercase">
      {label}
    </span>
    <span className="text-sm font-bold font-mono text-white">
      {val}
      <span className="text-white/40 text-[10px] ml-0.5">{unit}</span>
    </span>
  </div>
);
