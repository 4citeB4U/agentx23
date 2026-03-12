/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.LIVECHARTS.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = LiveCharts module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\LiveCharts.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — Live SVG Charts ────────────────────────────────────────────
// Pure SVG, zero external chart dependencies.

import React, { useMemo } from "react";
import { MetricHistory, RING_SIZE } from "./appTypes";

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLORS = {
  cpu: "#3b82f6", // blue
  memory: "#a855f7", // purple
  rps: "#22c55e", // green
  errorRate: "#ef4444", // red
  latencyP50: "#f59e0b", // amber
  latencyP95: "#f97316", // orange
  activeUsers: "#06b6d4", // cyan
};

const ANOMALY_THRESHOLDS: Record<string, number> = {
  cpu: 80,
  memory: 85,
  errorRate: 5,
  latencyP95: 150,
};

// ── Spark Line ─────────────────────────────────────────────────────────────────
interface SparkProps {
  values: number[];
  color: string;
  label: string;
  current: number;
  unit?: string;
  max?: number;
  height?: number;
  anomalyThreshold?: number;
}

export const SparkLine: React.FC<SparkProps> = ({
  values,
  color,
  label,
  current,
  unit = "%",
  max = 100,
  height = 52,
  anomalyThreshold,
}) => {
  const W = 200;
  const H = height;
  const PAD = 4;

  const pts = useMemo(() => {
    const effective = Math.max(...values, 1);
    const scale = (H - PAD * 2) / (max > 0 ? max : effective);
    return values
      .map((v, i) => {
        const x = PAD + (i / (RING_SIZE - 1)) * (W - PAD * 2);
        const y = H - PAD - v * scale;
        return `${x},${y}`;
      })
      .join(" ");
  }, [values, max, H]);

  const isAnomaly =
    anomalyThreshold !== undefined && current > anomalyThreshold;
  const displayColor = isAnomaly ? "#ef4444" : color;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">
          {label}
        </span>
        <span
          className={`live-charts-label text-[11px] font-bold font-mono transition-colors ${isAnomaly ? "text-red-400 animate-pulse" : ""}`}
          style={{ color: isAnomaly ? undefined : displayColor }}
        >
          {current.toFixed(unit === "ms" ? 0 : 1)}
          {unit}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Gradient fill */}
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={displayColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={displayColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Anomaly threshold line */}
        {anomalyThreshold !== undefined && (
          <line
            x1={PAD}
            y1={H - PAD - (anomalyThreshold / max) * (H - PAD * 2)}
            x2={W - PAD}
            y2={H - PAD - (anomalyThreshold / max) * (H - PAD * 2)}
            stroke="#ef4444"
            strokeWidth="0.5"
            strokeDasharray="3,3"
            opacity="0.4"
          />
        )}
        {/* Area fill */}
        <polygon
          points={`${pts} ${W - PAD},${H - PAD} ${PAD},${H - PAD}`}
          fill={`url(#grad-${label})`}
        />
        {/* Line */}
        <polyline
          points={pts}
          fill="none"
          stroke={displayColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Latest dot */}
        {(() => {
          const last = pts.split(" ").pop()?.split(",");
          if (!last) return null;
          return (
            <circle
              cx={last[0]}
              cy={last[1]}
              r="2.5"
              fill={displayColor}
              className="live-charts-circle"
            />
          );
        })()}
      </svg>
    </div>
  );
};

// ── Circular Gauge ─────────────────────────────────────────────────────────────
interface GaugeProps {
  value: number; // 0–100
  label: string;
  color: string;
  size?: number;
  unit?: string;
  criticalAt?: number;
}

export const CircularGauge: React.FC<GaugeProps> = ({
  value,
  label,
  color,
  size = 72,
  unit = "%",
  criticalAt = 80,
}) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const isCritical = value >= criticalAt;
  const c = isCritical ? "#ef4444" : color;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        <circle
          className="live-charts-circle"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            filter: `drop-shadow(0 0 6px ${c})`,
            transition: "stroke-dasharray 0.4s ease",
          }}
        />
        <text
          x={size / 2}
          y={size / 2 + 4}
          textAnchor="middle"
          fill={isCritical ? "#ef4444" : "white"}
          fontSize={size > 60 ? "14" : "11"}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {value.toFixed(0)}
          {unit}
        </text>
      </svg>
      <span className="text-[8px] font-mono tracking-widest text-white/40 uppercase">
        {label}
      </span>
    </div>
  );
};

// ── Donut Chart ────────────────────────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export const DonutChart: React.FC<{
  slices: DonutSlice[];
  size?: number;
  title?: string;
}> = ({ slices, size = 80, title }) => {
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-2">
      {title && (
        <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">
          {title}
        </span>
      )}
      <svg width={size} height={size}>
        {slices.map((sl, i) => {
          const fraction = sl.value / total;
          const dash = fraction * circ;
          const gap = circ - dash;
          const el = (
            <circle
              key={i}
              className="live-charts-circle"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={sl.color}
              strokeWidth="10"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ filter: `drop-shadow(0 0 4px ${sl.color})` }}
            />
          );
          offset += dash;
          return el;
        })}
        <circle cx={size / 2} cy={size / 2} r={r - 6} fill="rgba(0,0,0,0.6)" />
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {slices.map((sl) => (
          <span
            key={sl.label}
            className="flex items-center gap-1 text-[8px] font-mono"
          >
            <span className="live-charts-dot w-1.5 h-1.5 rounded-full" />
            <span className="text-white/50">{sl.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Full Chart Grid for Diagnostics Panel ──────────────────────────────────────
interface LiveChartGridProps {
  history: MetricHistory;
  latest: {
    cpu: number;
    memory: number;
    rps: number;
    errorRate: number;
    latencyP50?: number;
    latencyP95: number;
    activeUsers: number;
  } | null;
}

export const LiveChartGrid: React.FC<LiveChartGridProps> = ({
  history,
  latest,
}) => {
  if (!latest)
    return (
      <div className="flex items-center justify-center h-40 text-white/20 text-xs font-mono">
        AWAITING STREAM…
      </div>
    );

  const successRate = Math.max(0, 100 - latest.errorRate);

  return (
    <div className="space-y-4">
      {/* Gauge row */}
      <div className="flex items-center justify-around py-2">
        <CircularGauge
          value={latest.cpu}
          label="CPU"
          color={COLORS.cpu}
          criticalAt={80}
        />
        <CircularGauge
          value={latest.memory}
          label="MEM"
          color={COLORS.memory}
          criticalAt={85}
        />
        <CircularGauge
          value={Math.min(100, (latest.rps / 500) * 100)}
          label="RPS"
          color={COLORS.rps}
          unit=""
          criticalAt={95}
        />
        <CircularGauge
          value={latest.errorRate}
          label="ERR%"
          color={COLORS.errorRate}
          criticalAt={3}
        />
      </div>

      {/* Sparklines */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <SparkLine
          values={history.cpu}
          color={COLORS.cpu}
          label="CPU"
          current={latest.cpu}
          unit="%"
          max={100}
          anomalyThreshold={80}
        />
        <SparkLine
          values={history.memory}
          color={COLORS.memory}
          label="Memory"
          current={latest.memory}
          unit="%"
          max={100}
          anomalyThreshold={85}
        />
        <SparkLine
          values={history.rps}
          color={COLORS.rps}
          label="Req/sec"
          current={latest.rps}
          unit=""
          max={500}
        />
        <SparkLine
          values={history.errorRate}
          color={COLORS.errorRate}
          label="Error Rate"
          current={latest.errorRate}
          unit="%"
          max={20}
          anomalyThreshold={5}
        />
        <SparkLine
          values={history.latencyP50}
          color={COLORS.latencyP50}
          label="Latency p50"
          current={latest.latencyP50 ?? 0}
          unit="ms"
          max={200}
        />
        <SparkLine
          values={history.latencyP95}
          color={COLORS.latencyP95}
          label="Latency p95"
          current={latest.latencyP95 ?? 0}
          unit="ms"
          max={300}
          anomalyThreshold={150}
        />
        <SparkLine
          values={history.activeUsers}
          color={COLORS.activeUsers}
          label="Live Users"
          current={latest.activeUsers}
          unit=""
          max={200}
        />
      </div>

      {/* Donut — success vs failure */}
      <div className="flex justify-center pt-2">
        <DonutChart
          title="Request Distribution"
          size={90}
          slices={[
            { label: "Success", value: successRate, color: COLORS.rps },
            {
              label: "Error",
              value: latest.errorRate,
              color: COLORS.errorRate,
            },
          ]}
        />
      </div>
    </div>
  );
};
