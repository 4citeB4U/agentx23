// ── Agent Lee OS — Apps REST + WebSocket Route ────────────────────────────────
// Mount: app.use('/api/apps', appsRouter)
// WebSocket upgrades handled by setupAppsWs(server) called from index.ts

import { Router } from 'express';
import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// ── Types (mirrored from frontend appTypes) ──────────────────────────────────
type AppStatus = 'running' | 'stopped' | 'error' | 'degraded' | 'restarting' | 'repairing';

interface AppMetrics {
  cpu: number;
  memory: number;
  rps: number;
  errorRate: number;
  activeUsers: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  uptime: number;
  diskIO: number;
  networkRx: number;
  networkTx: number;
}

interface DeployedApp {
  id: string;
  name: string;
  deploymentId: string;
  status: AppStatus;
  subdomain: string;
  platform: string;
  lastUpdated: string;
  createdAt: string;
  metrics: AppMetrics;
}

// ── In-memory store ───────────────────────────────────────────────────────────
function makeMetrics(overrides: Partial<AppMetrics> = {}): AppMetrics {
  return {
    cpu: 20, memory: 40, rps: 12, errorRate: 0.1,
    activeUsers: 36, latencyP50: 24, latencyP95: 88, latencyP99: 210,
    uptime: 86_400, diskIO: 1.2, networkRx: 2048, networkTx: 4096,
    ...overrides,
  };
}

const store: Map<string, DeployedApp> = new Map([
  ['1', {
    id: '1', name: 'Agent Lee OS', deploymentId: 'dep-1',
    status: 'running', subdomain: 'agentlee.rapidwebdevelop.com',
    platform: 'cloudflare-pages',
    lastUpdated: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    metrics: makeMetrics({ cpu: 42, memory: 58, rps: 23, activeUsers: 69 }),
  }],
  ['2', {
    id: '2', name: 'Brain API', deploymentId: 'dep-2',
    status: 'running', subdomain: 'brain.rapidwebdevelop.com',
    platform: 'cloudflare-workers',
    lastUpdated: new Date(Date.now() - 7_200_000).toISOString(),
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    metrics: makeMetrics({ cpu: 18, memory: 39, rps: 11, activeUsers: 33 }),
  }],
  ['3', {
    id: '3', name: 'Gateway Proxy', deploymentId: 'dep-3',
    status: 'degraded', subdomain: 'gw.rapidwebdevelop.com',
    platform: 'cloudflare-workers',
    lastUpdated: new Date(Date.now() - 1_800_000).toISOString(),
    createdAt: new Date(Date.now() - 259_200_000).toISOString(),
    metrics: makeMetrics({ cpu: 75, memory: 81, rps: 5, errorRate: 3.2, activeUsers: 15 }),
  }],
]);

// ── Metric simulation ─────────────────────────────────────────────────────────
function jitter(base: number, pct = 5): number {
  return Math.max(0, base + base * (Math.random() * pct * 2 - pct) / 100);
}

function simulateTick(app: DeployedApp): AppMetrics {
  const m = app.metrics;
  const isActive = app.status === 'running' || app.status === 'degraded';
  return {
    cpu:         isActive ? jitter(m.cpu, 8) : 0,
    memory:      isActive ? jitter(m.memory, 3) : 0,
    rps:         isActive ? Math.round(jitter(m.rps, 15)) : 0,
    errorRate:   isActive ? Math.max(0, jitter(m.errorRate, 20)) : 0,
    activeUsers: isActive ? Math.round(jitter(m.activeUsers, 10)) : 0,
    latencyP50:  isActive ? Math.round(jitter(m.latencyP50, 12)) : 0,
    latencyP95:  isActive ? Math.round(jitter(m.latencyP95, 15)) : 0,
    latencyP99:  isActive ? Math.round(jitter(m.latencyP99, 18)) : 0,
    uptime:      m.uptime + 1,
    diskIO:      isActive ? jitter(m.diskIO, 10) : 0,
    networkRx:   isActive ? jitter(m.networkRx, 20) : 0,
    networkTx:   isActive ? jitter(m.networkTx, 20) : 0,
  };
}

// ── REST Router ───────────────────────────────────────────────────────────────
export const appsRouter = Router();

// GET /api/apps
appsRouter.get('/', (_req, res) => {
  res.json(Array.from(store.values()));
});

// GET /api/apps/:id
appsRouter.get('/:id', (req, res) => {
  const app = store.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json(app);
});

// GET /api/apps/:id/diagnostics
appsRouter.get('/:id/diagnostics', (req, res) => {
  const app = store.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json({ appId: app.id, snapshot: simulateTick(app), timestamp: Date.now() });
});

// POST /api/apps/:id/toggle
appsRouter.post('/:id/toggle', (req, res) => {
  const app = store.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  app.status = app.status === 'running' ? 'stopped' : 'running';
  app.lastUpdated = new Date().toISOString();
  res.json(app);
});

// POST /api/apps/:id/restart
appsRouter.post('/:id/restart', (req, res) => {
  const app = store.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  app.status = 'restarting';
  app.lastUpdated = new Date().toISOString();
  setTimeout(() => { app.status = 'running'; }, 2_500);
  res.json(app);
});

// POST /api/apps/:id/repair
appsRouter.post('/:id/repair', (req, res) => {
  const app = store.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  app.status = 'repairing';
  app.lastUpdated = new Date().toISOString();
  setTimeout(() => { app.status = 'running'; app.metrics.errorRate = 0; }, 3_500);
  res.json(app);
});

// DELETE /api/apps/:id
appsRouter.delete('/:id', (req, res) => {
  if (!store.has(req.params.id)) return res.status(404).json({ error: 'App not found' });
  store.delete(req.params.id);
  res.json({ deleted: req.params.id });
});

// ── WebSocket: /ws/apps/:id/metrics ──────────────────────────────────────────
// Exported and wired from index.ts upgrade handler.
// The upgrade handler calls appsWss.handleUpgrade → emits 'connection'.
// We extract appId from the original request URL here.
export const appsWss = new WebSocketServer({ noServer: true });

appsWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = req.url ?? '';
  const match = url.match(/\/ws\/apps\/([^/?]+)\/metrics/);
  const appId = match?.[1] ?? '';
  streamMetrics(ws, appId);
});

function streamMetrics(ws: WebSocket, appId: string): void {
  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return clearInterval(interval);
    const app = store.get(appId);
    if (!app) {
      ws.close(1008, 'App not found');
      clearInterval(interval);
      return;
    }
    // Update stored metrics so REST endpoints reflect live values too
    app.metrics = simulateTick(app);
    ws.send(JSON.stringify(app.metrics));
  }, 1_000);

  ws.on('close', () => clearInterval(interval));
  ws.on('error', () => clearInterval(interval));
}
