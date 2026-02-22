// ── Agent Lee OS — Diagnostics Panel ─────────────────────────────────────────

import { Activity, Clock, Pause, Play, X } from 'lucide-react';
import React, { useState } from 'react';
import { AppControls } from './AppControls';
import { LiveChartGrid } from './LiveCharts';
import { DeployedApp, STATUS_COLOR } from './appTypes';
import { formatUptime, usePolledMetrics } from './useAppMetrics';

interface Props {
  app: DeployedApp;
  onClose: () => void;
  onUpdate: (updated: DeployedApp) => void;
  onDelete: (id: string) => void;
}

export const DiagnosticsPanel: React.FC<Props> = ({ app, onClose, onUpdate, onDelete }) => {
  const [paused, setPaused] = useState(false);
  const { history, latest } = usePolledMetrics(app.id, paused);
  const color = STATUS_COLOR[app.status];

  // Prefer live data, fall back to initial app.metrics
  const m = latest ?? app.metrics;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base truncate">{app.name}</h3>
          <p className="text-white/40 text-[10px] font-mono">{app.subdomain}</p>
        </div>

        {/* Pause / Resume */}
        <button
          onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-1.5 rounded-xl bg-white/6 border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          <span className="hidden sm:inline">{paused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="rounded-xl bg-white/6 border border-white/10 p-2 text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={14} />
        </button>
      </div>

      {/* Controls */}
      <AppControls
        app={app}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDiagnostics={() => {/* already in diagnostics */}}
      />

      {/* Quick stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Uptime', val: formatUptime(m.uptime), icon: <Clock size={11} /> },
          { label: 'CPU', val: `${m.cpu.toFixed(1)}%`, icon: <Activity size={11} /> },
          { label: 'Memory', val: `${m.memory.toFixed(1)}%`, icon: <Activity size={11} /> },
          { label: 'RPS', val: String(m.rps), icon: <Activity size={11} /> },
          { label: 'P95', val: `${m.latencyP95}ms`, icon: <Activity size={11} /> },
          { label: 'Errors', val: `${m.errorRate.toFixed(2)}%`, icon: <Activity size={11} /> },
        ].map(({ label, val, icon }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-xl bg-white/4 border border-white/6 p-2"
          >
            <div className="flex items-center gap-1 text-white/30">
              {icon}
              <span className="text-[9px] font-mono uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-xs font-mono font-semibold text-white">{val}</span>
          </div>
        ))}
      </div>

      {/* Live chart grid */}
      <LiveChartGrid history={history} latest={latest} />

      {/* Engagement metrics */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-3">
          Engagement
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Active Users" val={m.activeUsers} unit="" />
          <Stat label="Net RX" val={(m.networkRx / 1024).toFixed(1)} unit="KB/s" />
          <Stat label="Net TX" val={(m.networkTx / 1024).toFixed(1)} unit="KB/s" />
        </div>
      </div>

      {/* Pause banner */}
      {paused && (
        <div className="text-center text-xs font-mono text-amber-400/80 bg-amber-400/8 border border-amber-400/20 rounded-xl py-2">
          ⏸ Metrics stream paused — click Resume to continue
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; val: number | string; unit: string }> = ({
  label,
  val,
  unit,
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] font-mono text-white/30 uppercase">{label}</span>
    <span className="text-sm font-bold font-mono text-white">
      {val}
      <span className="text-white/40 text-[10px] ml-0.5">{unit}</span>
    </span>
  </div>
);
