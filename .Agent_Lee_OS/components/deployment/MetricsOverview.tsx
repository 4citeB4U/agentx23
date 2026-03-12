/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.METRICSOVERVIEW.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = MetricsOverview module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\MetricsOverview.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — Metrics Overview (top summary bar) ────────────────────────

import {
    Activity,
    AlertCircle,
    CheckCircle,
    Server,
    Users,
    Zap,
} from "lucide-react";
import React from "react";
import { DeployedApp } from "./appTypes";

interface Props {
  apps: DeployedApp[];
}

interface Tile {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  glow: string;
}

export const MetricsOverview: React.FC<Props> = ({ apps }) => {
  if (!apps.length) return null;

  const running = apps.filter((a) => a.status === "running").length;
  const errors = apps.filter(
    (a) => a.status === "error" || a.status === "degraded",
  ).length;
  const stopped = apps.filter((a) => a.status === "stopped").length;
  const totalRPS = apps.reduce((s, a) => s + a.metrics.rps, 0);
  const avgCPU = (
    apps.reduce((s, a) => s + a.metrics.cpu, 0) / apps.length
  ).toFixed(0);
  const totalUsers = apps.reduce((s, a) => s + a.metrics.activeUsers, 0);

  const tiles: Tile[] = [
    {
      icon: <Server size={14} />,
      label: "Running",
      value: `${running} / ${apps.length}`,
      color: "text-emerald-400",
      glow: "rgba(34,197,94,0.15)",
    },
    {
      icon: <AlertCircle size={14} />,
      label: "Issues",
      value: String(errors),
      color: errors > 0 ? "text-red-400" : "text-white/30",
      glow: errors > 0 ? "rgba(239,68,68,0.15)" : "transparent",
    },
    {
      icon: <CheckCircle size={14} />,
      label: "Stopped",
      value: String(stopped),
      color: "text-gray-400",
      glow: "rgba(255,255,255,0.04)",
    },
    {
      icon: <Zap size={14} />,
      label: "Req/sec",
      value:
        totalRPS > 1000 ? `${(totalRPS / 1000).toFixed(1)}k` : String(totalRPS),
      color: "text-blue-400",
      glow: "rgba(59,130,246,0.15)",
    },
    {
      icon: <Activity size={14} />,
      label: "Avg CPU",
      value: `${avgCPU}%`,
      color: Number(avgCPU) > 80 ? "text-red-400" : "text-amber-400",
      glow:
        Number(avgCPU) > 80 ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
    },
    {
      icon: <Users size={14} />,
      label: "Live Users",
      value: String(totalUsers),
      color: "text-cyan-400",
      glow: "rgba(6,182,212,0.15)",
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="metrics-overview-row flex flex-col gap-1 rounded-xl border border-white/8 p-3"
          data-glow={t.glow}
          ref={(el) => {
            if (el) el.style.background = t.glow;
          }}
        >
          <div className={`flex items-center gap-1.5 ${t.color}`}>
            {t.icon}
            <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">
              {t.label}
            </span>
          </div>
          <span className={`text-lg font-bold font-mono ${t.color}`}>
            {t.value}
          </span>
        </div>
      ))}
    </div>
  );
};
