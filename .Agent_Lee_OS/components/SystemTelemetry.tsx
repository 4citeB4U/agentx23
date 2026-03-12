/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.SYSTEMTELEMETRY.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = SystemTelemetry module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\SystemTelemetry.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// LEEWAY-HEADER
// TAG: OPS.TELEMETRY.PORT_MONITOR
// REGION: ⚙️ SYSTEM

const ports = Array.from({ length: 21 }, (_, i) => 6000 + i);

export const PortMonitor = () => {
  return (
    <div className="grid grid-cols-7 gap-2 p-4 bg-black/50 rounded-xl border border-cyan-500/30">
      {ports.map((port) => (
        <div
          key={port}
          className="flex flex-col items-center p-2 border border-white/10 rounded"
        >
          <span className="text-[10px] text-cyan-400 font-mono">{port}</span>
          <div
            className={`w-3 h-3 rounded-full ${false ? "bg-green-500 shadow-[0_0_10px_green]" : "bg-red-900"}`}
          />
        </div>
      ))}
      <div className="col-span-7 mt-4 text-xs font-mono text-white/50">
        PI-MODE: ACTIVE (2 CORES / 1.2GB) | MODE: NORMAL
      </div>
    </div>
  );
};
import {
  AlertTriangle,
  Brain,
  Cpu,
  HardDrive,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { BACKEND_URL } from "../constants";
import { SovereignIdentity } from "../services/SovereignIdentity";

interface ServiceHealth {
  name: string;
  port: number;
  status: "online" | "offline" | "warning";
  lastChecked: string;
}

interface TelemetryData {
  timestamp: string;
  services: ServiceHealth[];
  overallStatus: "nominal" | "degraded";
  ai: { bridge: string; port: number; status: string; memory: boolean };
}

interface AdapterStat {
  episodes: number;
  avg_reward: number;
  avg_correctness: number;
  total_hallucinations: number;
  avg_planning_depth: number;
  success_rate: number;
}

interface MissionOutcome {
  ts: string;
  domain: string;
  adapter: string;
  reward: number;
  outcome: string;
}

interface DriftDay {
  day: string;
  avg_reward: number;
  avg_halluc: number;
  avg_depth: number;
  total_episodes: number;
  synthetic_ratio: number;
}

interface DriftData {
  window_days: number;
  trend: DriftDay[];
  adapter_dominance: Record<string, number>;
}

interface BrainStatus {
  base_model: string;
  voice_state: string;
  episodes_today: number;
  episodes_total: number;
  episodes_by_domain: Record<string, number>;
  adapter_performance: Record<string, AdapterStat>;
  last_10_missions: MissionOutcome[];
  synthetic_generated: number;
  synthetic_threshold: number;
  intelligence_loop: { reward_formula: string };
}

const ADAPTER_SHORT: Record<string, string> = {
  qwen_general_adapter: "GENERAL",
  qwen_code_adapter: "CODE",
  qwen_ui_adapter: "UI",
  qwen_cdl_adapter: "CDL",
};

const ADAPTER_COLOR: Record<string, string> = {
  qwen_general_adapter: "text-cyan-400",
  qwen_code_adapter: "text-emerald-400",
  qwen_ui_adapter: "text-purple-400",
  qwen_cdl_adapter: "text-amber-400",
};

const rewardColor = (r: number) =>
  r >= 0.8 ? "text-emerald-400" : r >= 0.5 ? "text-amber-400" : "text-red-400";

export const SystemTelemetry: React.FC = () => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [brain, setBrain] = useState<BrainStatus | null>(null);
  const [drift, setDrift] = useState<DriftData | null>(null);
  const [tab, setTab] = useState<"ports" | "adapters" | "missions" | "drift">(
    "ports",
  );

  const fetchAll = async () => {
    try {
      const signed = await SovereignIdentity.signRequest({});

      const [telR, brainR, driftR] = await Promise.all([
        fetch(`${BACKEND_URL}/api/services/telemetry`, { headers: signed }),
        fetch(`${BACKEND_URL}/api/brain/status`, { headers: signed }),
        fetch(`${BACKEND_URL}/api/brain/drift`, { headers: signed }),
      ]);

      if (telR.ok) setData(await telR.json());
      if (brainR.ok) setBrain(await brainR.json());
      if (driftR.ok) setDrift(await driftR.json());
    } catch (e) {
      console.error("[SystemTelemetry] fetch failed:", e);
    }
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 12000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  const adapterEntries = brain
    ? (Object.entries(brain.adapter_performance || {}) as [
        string,
        AdapterStat,
      ][])
    : [];
  const bestAdapter = adapterEntries.sort(
    ([, a], [, b]) => b.avg_reward - a.avg_reward,
  )[0];

  return (
    <div className="bg-black/80 backdrop-blur-xl border border-studio-border/30 rounded-2xl p-4 w-80 shadow-2xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-studio-border/20 pb-2">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-[10px] font-mono text-studio-secondary uppercase tracking-widest">
            Sovereign_Intelligence
          </span>
        </div>
        <div
          className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${
            data.overallStatus === "nominal"
              ? "bg-cyan-400/20 text-cyan-400"
              : "bg-red-500/20 text-red-500"
          }`}
        >
          {data.overallStatus}
        </div>
      </div>

      {/* Brain quick stats */}
      {brain && (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <div className="text-[16px] font-bold text-cyan-400">
              {brain.episodes_today}
            </div>
            <div className="text-[8px] text-studio-secondary/60 font-mono uppercase">
              Today
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <div className="text-[16px] font-bold text-purple-400">
              {brain.episodes_total}
            </div>
            <div className="text-[8px] text-studio-secondary/60 font-mono uppercase">
              Total
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <div className="text-[16px] font-bold text-emerald-400">
              {brain.synthetic_generated}
            </div>
            <div className="text-[8px] text-studio-secondary/60 font-mono uppercase">
              Synthetic
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
        {(["ports", "adapters", "missions", "drift"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-[8px] font-mono uppercase py-1 rounded transition-all ${
              tab === t
                ? "bg-cyan-400/20 text-cyan-400"
                : "text-studio-secondary/50 hover:text-studio-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── PORTS TAB ── */}
      {tab === "ports" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[9px] text-studio-secondary/60 uppercase font-mono mb-1">
            <HardDrive size={10} />
            <span>Port_Enforcement</span>
          </div>
          {data.services.map((s) => (
            <div
              key={s.port}
              className="flex items-center justify-between text-[10px] bg-white/5 p-1.5 rounded-lg"
            >
              <span className="text-studio-secondary">
                {s.name} ({s.port})
              </span>
              <span
                className={
                  s.status === "online" ? "text-cyan-400" : "text-red-500"
                }
              >
                {s.status === "online" ? "● SYNCED" : "○ DROPPED"}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between text-[10px] bg-white/5 p-1.5 rounded-lg pt-2 mt-1 border-t border-studio-border/10">
            <span className="text-studio-secondary">Voice State</span>
            <span
              className={`font-mono uppercase ${brain?.voice_state === "PRIMARY" ? "text-cyan-400" : "text-amber-400"}`}
            >
              {brain?.voice_state || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] bg-white/5 p-1.5 rounded-lg">
            <span className="text-studio-secondary">Base Model</span>
            <span className="text-studio-accent font-mono uppercase text-[9px]">
              {brain?.base_model || "Qwen"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] bg-white/5 p-1.5 rounded-lg">
            <div className="flex items-center gap-1">
              <Shield size={9} className="text-cyan-400" />
              <span className="text-studio-secondary">Handshake</span>
            </div>
            <span className="text-cyan-400 uppercase">ACTIVE</span>
          </div>
        </div>
      )}

      {/* ── ADAPTERS TAB ── */}
      {tab === "adapters" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[9px] text-studio-secondary/60 uppercase font-mono mb-1">
            <Cpu size={10} />
            <span>Adapter_Performance</span>
          </div>
          {adapterEntries.length === 0 && (
            <div className="text-[10px] text-studio-secondary/40 text-center py-3 font-mono">
              No episodes logged yet
            </div>
          )}
          {adapterEntries.map(([adapter, stat]) => (
            <div key={adapter} className="bg-white/5 rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono font-bold ${ADAPTER_COLOR[adapter] || "text-white"}`}
                >
                  {ADAPTER_SHORT[adapter] || adapter}
                </span>
                <span className="text-[9px] text-studio-secondary/40">
                  {stat.episodes} eps
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex justify-between text-[9px]">
                  <span className="text-studio-secondary/50">Reward</span>
                  <span className={rewardColor(stat.avg_reward)}>
                    {stat.avg_reward.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-studio-secondary/50">Success</span>
                  <span className="text-emerald-400">
                    {(stat.success_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-studio-secondary/50">Depth</span>
                  <span className="text-purple-400">
                    {stat.avg_planning_depth.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-studio-secondary/50 flex items-center gap-0.5">
                    <AlertTriangle size={7} />
                    Halluc
                  </span>
                  <span
                    className={
                      stat.total_hallucinations > 0
                        ? "text-red-400"
                        : "text-emerald-400"
                    }
                  >
                    {stat.total_hallucinations}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {bestAdapter && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-studio-border/10">
              <Zap size={9} className="text-amber-400" />
              <span className="text-[9px] text-studio-secondary/60">Best:</span>
              <span
                className={`text-[9px] font-mono ${ADAPTER_COLOR[bestAdapter[0]] || "text-white"}`}
              >
                {ADAPTER_SHORT[bestAdapter[0]]} (
                {bestAdapter[1].avg_reward.toFixed(2)} R)
              </span>
            </div>
          )}
          {brain && (
            <div className="text-[8px] text-studio-secondary/30 font-mono pt-1 truncate">
              R = c×0.4 + q×0.3 + d×0.2 − h×0.1
            </div>
          )}
        </div>
      )}

      {/* ── MISSIONS TAB ── */}
      {tab === "missions" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[9px] text-studio-secondary/60 uppercase font-mono mb-1">
            <TrendingUp size={10} />
            <span>Last_10_Missions</span>
          </div>
          {!brain?.last_10_missions?.length && (
            <div className="text-[10px] text-studio-secondary/40 text-center py-3 font-mono">
              No missions logged yet
            </div>
          )}
          {(brain?.last_10_missions || []).map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[9px] bg-white/5 p-1.5 rounded-lg"
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className={`font-mono uppercase ${ADAPTER_COLOR[m.adapter] || "text-white"}`}
                >
                  {ADAPTER_SHORT[m.adapter] || (m.adapter || "?").slice(0, 8)}
                </span>
                <span className="text-studio-secondary/40 text-[8px]">
                  {m.domain}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className={rewardColor(m.reward || 0)}>
                  R={(m.reward || 0).toFixed(2)}
                </span>
                <span
                  className={`text-[8px] uppercase ${
                    m.outcome === "ok"
                      ? "text-emerald-400/70"
                      : m.outcome === "fallback"
                        ? "text-amber-400/70"
                        : "text-studio-secondary/40"
                  }`}
                >
                  {m.outcome}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DRIFT TAB ── */}
      {tab === "drift" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[9px] text-studio-secondary/60 uppercase font-mono mb-1">
            <TrendingUp size={10} />
            <span>Learning_Drift · 7d</span>
          </div>
          {!drift?.trend?.length && (
            <div className="text-[10px] text-studio-secondary/40 text-center py-3 font-mono">
              Insufficient data (need 1 episode)
            </div>
          )}
          {/* Sparkline rows per day */}
          {(drift?.trend || []).map((d) => {
            const barW = Math.round(d.avg_reward * 100);
            return (
              <div key={d.day} className="bg-white/5 rounded-lg p-2 space-y-1">
                <div className="flex justify-between text-[9px]">
                  <span className="text-studio-secondary/60 font-mono">
                    {d.day.slice(5)}
                  </span>
                  <span className="text-studio-secondary/40">
                    {d.total_episodes} eps
                  </span>
                </div>
                {/* Reward bar */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-studio-secondary/40 w-10">
                    Reward
                  </span>
                  <progress
                    className={`flex-1 telemetry-progress ${
                      d.avg_reward >= 0.8
                        ? "bar-emerald"
                        : d.avg_reward >= 0.5
                          ? "bar-amber"
                          : "bar-red"
                    }`}
                    value={barW}
                    max={100}
                  />
                  <span
                    className={`text-[8px] font-mono ${rewardColor(d.avg_reward)}`}
                  >
                    {d.avg_reward.toFixed(2)}
                  </span>
                </div>
                {/* Hallucination */}
                <div className="grid grid-cols-3 gap-1">
                  <div className="flex flex-col items-center">
                    <span
                      className={`text-[10px] font-mono ${
                        d.avg_halluc > 1
                          ? "text-red-400"
                          : d.avg_halluc > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {d.avg_halluc.toFixed(1)}
                    </span>
                    <span className="text-[7px] text-studio-secondary/30">
                      Halluc
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono text-purple-400">
                      {d.avg_depth.toFixed(1)}
                    </span>
                    <span className="text-[7px] text-studio-secondary/30">
                      Depth
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono text-cyan-400">
                      {(d.synthetic_ratio * 100).toFixed(0)}%
                    </span>
                    <span className="text-[7px] text-studio-secondary/30">
                      Synth
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Adapter dominance */}
          {drift?.adapter_dominance &&
            Object.keys(drift.adapter_dominance).length > 0 && (
              <div className="pt-1 border-t border-studio-border/10 space-y-1">
                <div className="text-[8px] text-studio-secondary/40 font-mono uppercase">
                  Adapter Dominance
                </div>
                {(
                  Object.entries(drift.adapter_dominance) as [string, number][]
                ).map(([adapter, share]) => (
                  <div key={adapter} className="flex items-center gap-1.5">
                    <span
                      className={`text-[8px] font-mono w-14 ${ADAPTER_COLOR[adapter] || "text-white"}`}
                    >
                      {ADAPTER_SHORT[adapter] || adapter.slice(0, 8)}
                    </span>
                    <progress
                      className={`flex-1 telemetry-progress ${
                        adapter.includes("general")
                          ? "bar-cyan"
                          : adapter.includes("code")
                            ? "bar-emerald"
                            : adapter.includes("ui")
                              ? "bar-purple"
                              : adapter.includes("cdl")
                                ? "bar-amber"
                                : "bar-white"
                      }`}
                      value={Math.round(share * 100)}
                      max={100}
                    />
                    <span className="text-[8px] text-studio-secondary/50">
                      {(share * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Footer */}
      <div className="pt-1 flex justify-between items-center border-t border-studio-border/10">
        <span className="text-[8px] text-studio-secondary/30 font-mono">
          v3 · LOOP_ACTIVE
        </span>
        <span className="text-[8px] text-studio-secondary/30 font-mono">
          {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};
