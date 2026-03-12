/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.USEAPPMETRICS.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = useAppMetrics module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\useAppMetrics.ts
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — App Metrics WebSocket Hook ─────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppMetricSnapshot, DeployedApp, makeEmptyHistory, MetricHistory, pushToHistory, RING_SIZE } from './appTypes';

const BACKEND = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8001';
const WS_BASE = BACKEND.replace(/^http/, 'ws');
const HANDSHAKE = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined;

function authHeaders(): HeadersInit {
  return HANDSHAKE ? { 'x-neural-handshake': HANDSHAKE } : {};
}

// ── REST helpers ───────────────────────────────────────────────────────────────
export async function fetchApps(): Promise<DeployedApp[]> {
  const r = await fetch(`${BACKEND}/api/apps`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`fetchApps ${r.status}`);
  return r.json();
}

export async function appAction(id: string, action: 'toggle' | 'restart' | 'repair', method: 'POST' | 'DELETE' = 'POST'): Promise<DeployedApp> {
  const url = action === 'toggle' ? `${BACKEND}/api/apps/${id}/toggle`
            : action === 'restart' ? `${BACKEND}/api/apps/${id}/restart`
            : `${BACKEND}/api/apps/${id}/repair`;
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() } });
  if (!r.ok) throw new Error(`${action} ${r.status}`);
  return r.json();
}

export async function deleteApp(id: string): Promise<void> {
  const r = await fetch(`${BACKEND}/api/apps/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!r.ok) throw new Error(`delete ${r.status}`);
}

// ── WebSocket hook — streams metric ticks for one app ─────────────────────────
export function useAppMetricsStream(appId: string | null, paused: boolean) {
  const [history, setHistory] = useState<MetricHistory>(makeEmptyHistory());
  const [latest, setLatest] = useState<AppMetricSnapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!appId) return;
    wsRef.current?.close();
    const ws = new WebSocket(`${WS_BASE}/ws/apps/${appId}/metrics`);
    ws.onmessage = (e) => {
      if (paused) return;
      try {
        const snap: AppMetricSnapshot = JSON.parse(e.data);
        setLatest(snap);
        setHistory((h) => pushToHistory(h, snap));
      } catch {/* ignore parse errors */}
    };
    ws.onclose = () => {
      // Reconnect after 2s
      setTimeout(() => { if (appId) connect(); }, 2000);
    };
    wsRef.current = ws;
  }, [appId, paused]); // eslint-disable-line

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [appId]); // eslint-disable-line

  const reset = () => setHistory(makeEmptyHistory());

  return { history, latest, reset };
}

// ── Polling fallback — simulates metrics when WS unavailable ─────────────────
export function usePolledMetrics(appId: string | null, paused: boolean) {
  const [history, setHistory] = useState<MetricHistory>(makeEmptyHistory());
  const [latest, setLatest] = useState<AppMetricSnapshot | null>(null);

  useEffect(() => {
    if (!appId) return;
    const tick = () => {
      if (paused) return;
      // Fetch from REST diagnostics endpoint, fallback to simulated data
      fetch(`${BACKEND}/api/apps/${appId}/diagnostics`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((snap: AppMetricSnapshot | null) => {
          const s = snap ?? simulateTick();
          setLatest(s);
          setHistory((h) => pushToHistory(h, s));
        })
        .catch(() => {
          const s = simulateTick();
          setLatest(s);
          setHistory((h) => pushToHistory(h, s));
        });
    };
    tick();
    const interval = setInterval(tick, 1500);
    return () => clearInterval(interval);
  }, [appId, paused]); // eslint-disable-line

  const reset = () => setHistory(makeEmptyHistory());
  return { history, latest, reset };
}

// ── Chart-safe normalise (0→100 clamp) ───────────────────────────────────────
export function normalise(val: number, max = 100): number {
  return Math.max(0, Math.min(100, (val / max) * 100));
}

// ── Simulated tick for demo / offline mode ────────────────────────────────────
let _cpu = 35, _mem = 52, _rps = 120, _lat50 = 40, _lat95 = 85, _users = 23;

function jitter(v: number, range: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v + (Math.random() - 0.5) * range));
}

export function simulateTick(): AppMetricSnapshot {
  _cpu    = jitter(_cpu,    8,  2, 95);
  _mem    = jitter(_mem,    4, 20, 90);
  _rps    = jitter(_rps,   20,  0, 500);
  _lat50  = jitter(_lat50,  5, 10, 100);
  _lat95  = jitter(_lat95,  8, 30, 200);
  _users  = jitter(_users,  3,  0,  150);
  return {
    cpu:        Math.round(_cpu),
    memory:     Math.round(_mem),
    rps:        Math.round(_rps),
    errorRate:  parseFloat((Math.random() * 2).toFixed(2)),
    activeUsers: Math.round(_users),
    latencyP50: Math.round(_lat50),
    latencyP95: Math.round(_lat95),
    latencyP99: Math.round(_lat95 * 1.4),
    uptime:     Date.now() / 1000 - 86400,
    diskIO:     parseFloat((Math.random() * 5).toFixed(1)),
    networkRx:  parseFloat((Math.random() * 200).toFixed(1)),
    networkTx:  parseFloat((Math.random() * 80).toFixed(1)),
  };
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
