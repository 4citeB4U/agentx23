/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.APPCARD.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = AppCard module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\AppCard.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — App Card ───────────────────────────────────────────────────

import { Clock, Cpu, Globe, MemoryStick, Users } from 'lucide-react';
import React from 'react';
import { AppControls } from './AppControls';
import { DeployedApp, STATUS_COLOR } from './appTypes';
import { formatUptime } from './useAppMetrics';

interface Props {
  app: DeployedApp;
  selected?: boolean;
  onSelect: (id: string) => void;
  onUpdate: (updated: DeployedApp) => void;
  onDelete: (id: string) => void;
}

export const AppCard: React.FC<Props> = ({ app, selected, onSelect, onUpdate, onDelete }) => {
  const color = STATUS_COLOR[app.status];
  const isAlert = app.status === 'error' || app.status === 'degraded';

  const mini: Array<{ icon: React.ReactNode; val: string; title: string }> = [
    { icon: <Cpu size={11} />, val: `${app.metrics.cpu.toFixed(0)}%`, title: 'CPU' },
    { icon: <MemoryStick size={11} />, val: `${app.metrics.memory.toFixed(0)}%`, title: 'MEM' },
    { icon: <Users size={11} />, val: String(app.metrics.activeUsers), title: 'Users' },
    { icon: <Globe size={11} />, val: `${app.metrics.rps}rps`, title: 'Req/s' },
  ];

  return (
    <div
      onClick={() => onSelect(app.id)}
      className="relative flex flex-col gap-3 rounded-2xl border p-4 cursor-pointer transition-all duration-300 select-none"
      style={{
        background: selected ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.35)',
        borderColor: isAlert ? color : selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
        boxShadow: isAlert ? `0 0 18px ${color}44` : selected ? '0 0 18px rgba(255,255,255,0.06)' : 'none',
      }}
    >
      {/* Status dot */}
      <span
        className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />

      {/* Header */}
      <div className="pr-6">
        <p className="font-bold text-white text-sm truncate">{app.name}</p>
        <p className="text-white/40 text-[10px] font-mono truncate">{app.subdomain}</p>
      </div>

      {/* Status label */}
      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-semibold"
          style={{ background: `${color}22`, color }}
        >
          {app.status}
        </span>
        <span className="text-white/25 text-[9px] font-mono flex items-center gap-1">
          <Clock size={9} />
          {formatUptime(app.metrics.uptime)}
        </span>
      </div>

      {/* Mini metrics */}
      <div className="grid grid-cols-4 gap-1">
        {mini.map((m) => (
          <div
            key={m.title}
            title={m.title}
            className="flex flex-col items-center gap-0.5 rounded-lg bg-white/4 p-1.5"
          >
            <span className="text-white/40">{m.icon}</span>
            <span className="text-[9px] font-mono text-white/70">{m.val}</span>
          </div>
        ))}
      </div>

      {/* Controls (compact / icon-only) */}
      <div onClick={(e) => e.stopPropagation()}>
        <AppControls
          app={app}
          compact
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDiagnostics={() => onSelect(app.id)}
        />
      </div>
    </div>
  );
};
