/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.APPDASHBOARD.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = AppDashboard module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\AppDashboard.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — App Dashboard (Tab.APPS) ──────────────────────────────────

import { RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppList } from './AppList';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { MetricsOverview } from './MetricsOverview';
import { DeployedApp } from './appTypes';
import { fetchApps } from './useAppMetrics';

// ── Demo apps shown when the backend is unreachable ──────────────────────────
function makeDemoApps(): DeployedApp[] {
  const now = Date.now();

  const demo = (
    id: string,
    name: string,
    subdomain: string,
    status: DeployedApp['status'],
    cpu: number,
    mem: number,
    rps: number,
  ): DeployedApp => ({
    id,
    name,
    deploymentId: `dep-${id}-demo`,
    status,
    subdomain,
    platform: 'cloudflare',
    lastUpdated: new Date(now - 3600_000).toISOString(),
    createdAt: new Date(now - 86_400_000).toISOString(),
    metrics: {
      cpu,
      memory: mem,
      rps,
      errorRate: status === 'error' ? 4.2 : 0.1,
      activeUsers: Math.floor(rps * 3),
      latencyP50: 28,
      latencyP95: 85,
      latencyP99: 210,
      uptime: 86_400,
      diskIO: 1.4,
      networkRx: 2048,
      networkTx: 4096,
    },
  });

  return [
    demo('1', 'Agent Lee OS',    'agentlee.rapidwebdevelop.com',  'running',  42, 58, 23),
    demo('2', 'Brain API',       'brain.rapidwebdevelop.com',     'running',  18, 39, 11),
    demo('3', 'Gateway Proxy',   'gw.rapidwebdevelop.com',        'degraded', 75, 81, 5),
    demo('4', 'Voice Service',   'voice.rapidwebdevelop.com',     'stopped',  0,  0,  0),
    demo('5', 'Desktop Agent',   'desktop.rapidwebdevelop.com',   'error',    0,  0,  0),
  ];
}

const REFRESH_INTERVAL = 5_000;

export const AppDashboard: React.FC = () => {
  const [apps, setApps]               = useState<DeployedApp[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [demo, setDemo]               = useState(false);
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchApps();
      setApps(data);
      setDemo(false);
      setError(null);
    } catch {
      // Backend unavailable — show demo
      if (!demo) {
        setApps(makeDemoApps());
        setDemo(true);
      }
      setError('Backend offline — showing demo data');
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Optimistic update helper */
  const handleUpdate = useCallback((updated: DeployedApp) => {
    setApps((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const selectedApp = apps.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full gap-4 p-4 text-white">
      {/* ── Title bar */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold">Deployment Dashboard</h2>

        {demo && (
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 uppercase">
            Demo
          </span>
        )}

        {error && !demo && (
          <span className="text-[9px] font-mono text-red-400">{error}</span>
        )}

        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors disabled:opacity-30"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Metrics overview */}
      {!loading && <MetricsOverview apps={apps} />}

      {/* ── Main area: list always full-width; diagnostics opens as a slide-over overlay */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* App list — always full width, visible underneath the drawer */}
        <div className="h-full overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm font-mono h-full">
              Loading apps…
            </div>
          ) : (
            <AppList
              apps={apps}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* Slide-over drawer — overlays the list from the right */}
        {selectedApp && (
          <div className="absolute inset-0 z-20 flex">
            {/* Backdrop — click to dismiss */}
            <div
              className="flex-1 bg-black/50 backdrop-blur-sm cursor-pointer"
              onClick={() => setSelectedId(null)}
            />
            {/* Panel — fixed width, full height, scrollable */}
            <div className="w-full max-w-2xl h-full overflow-y-auto bg-[#0a0a0f] border-l border-white/10 shadow-2xl">
              <DiagnosticsPanel
                app={selectedApp}
                onClose={() => setSelectedId(null)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
