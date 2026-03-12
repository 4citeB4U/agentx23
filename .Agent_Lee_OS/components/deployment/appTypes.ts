/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.APPTYPES.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = appTypes module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\appTypes.ts
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — Deployment Dashboard Types ─────────────────────────────────

export type AppStatus = 'running' | 'stopped' | 'error' | 'degraded' | 'restarting' | 'repairing';

export interface AppMetricSnapshot {
  cpu: number;        // 0–100
  memory: number;     // 0–100
  rps: number;        // requests/sec
  errorRate: number;  // 0–100
  activeUsers: number;
  latencyP50: number; // ms
  latencyP95: number;
  latencyP99: number;
  uptime: number;     // seconds
  diskIO: number;     // MB/s
  networkRx: number;  // KB/s
  networkTx: number;  // KB/s
}

export interface DeployedApp {
  id: string;
  name: string;
  deploymentId: string;
  status: AppStatus;
  subdomain: string;
  platform: 'cloudflare' | 'vercel' | 'fly' | 'local';
  lastUpdated: string;   // ISO timestamp
  createdAt: string;
  metrics: AppMetricSnapshot;
}

// Ring buffer of metric readings (for chart display)
export interface MetricHistory {
  timestamps: number[];
  cpu: number[];
  memory: number[];
  rps: number[];
  errorRate: number[];
  activeUsers: number[];
  latencyP50: number[];
  latencyP95: number[];
}

export const RING_SIZE = 60; // 60 data points — 1 minute at 1s interval

export function makeEmptyHistory(): MetricHistory {
  const empty = Array(RING_SIZE).fill(0);
  return {
    timestamps: Array(RING_SIZE).fill(Date.now()),
    cpu: [...empty],
    memory: [...empty],
    rps: [...empty],
    errorRate: [...empty],
    activeUsers: [...empty],
    latencyP50: [...empty],
    latencyP95: [...empty],
  };
}

export function pushToHistory(h: MetricHistory, snap: AppMetricSnapshot): MetricHistory {
  const push = <T>(arr: T[], val: T): T[] => [...arr.slice(1), val];
  return {
    timestamps: push(h.timestamps, Date.now()),
    cpu: push(h.cpu, snap.cpu),
    memory: push(h.memory, snap.memory),
    rps: push(h.rps, snap.rps),
    errorRate: push(h.errorRate, snap.errorRate),
    activeUsers: push(h.activeUsers, snap.activeUsers),
    latencyP50: push(h.latencyP50, snap.latencyP50),
    latencyP95: push(h.latencyP95, snap.latencyP95),
  };
}

export const STATUS_COLOR: Record<AppStatus, string> = {
  running:    '#22c55e',
  stopped:    '#6b7280',
  error:      '#ef4444',
  degraded:   '#f59e0b',
  restarting: '#3b82f6',
  repairing:  '#a855f7',
};

export const STATUS_LABEL: Record<AppStatus, string> = {
  running:    'RUNNING',
  stopped:    'STOPPED',
  error:      'ERROR',
  degraded:   'DEGRADED',
  restarting: 'RESTARTING',
  repairing:  'REPAIRING',
};
