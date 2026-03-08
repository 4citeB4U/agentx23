# MCP Integration — Dashboard MCP & Browser MCP

> **LEEWAY-CORE-2026 compliant.** VM-First policy applies — run commands inside Agent Lee VM where possible.

---

## Overview

Two lightweight MCP-style HTTP agents are baked into the Agent Lee OS using the services already present in the repo. No external MCPs are required.

| Service                 | Port     | Purpose                                                 |
| ----------------------- | -------- | ------------------------------------------------------- |
| `AgentLee-DashboardMCP` | **7008** | Polls PM2 + backend health; exposes agent/LLM status    |
| `AgentLee-BrowserMCP`   | **7009** | Headless browser agent (Playwright or VM-exec fallback) |

Both are proxied through the AgentLee-Backend at `/api/mcp/dashboard/*` and `/api/mcp/browser/*`, and secured by the `x-neural-handshake` header.

---

## Directory Structure

```
services/
  dashboard-mcp/
    index.js          ← Express service, port 7008
    package.json
  browser-mcp/
    index.js          ← Express service, port 7009
    package.json
backend/src/routes/
  mcpDashboard.ts     ← Proxy: /api/mcp/dashboard/*
  mcpBrowser.ts       ← Proxy: /api/mcp/browser/*
ecosystem.config.cjs  ← PM2 entries added (AgentLee-DashboardMCP, AgentLee-BrowserMCP)
```

---

## Step 1 — Install dependencies

```powershell
# Dashboard MCP
cd C:\Tools\Portable-VSCode-MCP-Kit\services\dashboard-mcp
npm install

# Browser MCP
cd C:\Tools\Portable-VSCode-MCP-Kit\services\browser-mcp
npm install

# Optional: install Playwright (adds real headless Chrome support to Browser MCP)
npx playwright install chromium --with-deps
```

---

## Step 2 — Rebuild the backend (TypeScript)

The two new backend proxy routes must be compiled before the backend starts.

```powershell
cd C:\Tools\Portable-VSCode-MCP-Kit
npm run build
# — or —
tsc --build backend/tsconfig.json
```

---

## Step 3 — Start / reload via PM2

If PM2 is already running the Agent Lee ecosystem, a reload picks up the two new entries:

```powershell
cd C:\Tools\Portable-VSCode-MCP-Kit
pm2 reload ecosystem.config.cjs --update-env
```

To start fresh:

```powershell
pm2 start ecosystem.config.cjs
```

To start only the two new agents:

```powershell
pm2 start ecosystem.config.cjs --only AgentLee-DashboardMCP
pm2 start ecosystem.config.cjs --only AgentLee-BrowserMCP
```

Save the PM2 process list so agents survive a reboot:

```powershell
pm2 save
```

---

## Step 4 — Verify the services are alive

```powershell
# PM2 status
pm2 status

# Dashboard MCP health (no auth needed)
curl http://127.0.0.1:7008/health

# Browser MCP health (no auth needed)
curl http://127.0.0.1:7009/health

# Via backend proxy (requires handshake)
$h = "AGENT_LEE_SOVEREIGN_V1"
curl -H "x-neural-handshake: $h" http://127.0.0.1:7001/api/mcp/dashboard/health
curl -H "x-neural-handshake: $h" http://127.0.0.1:7001/api/mcp/browser/health
```

---

## API Reference

### Dashboard MCP — `/api/mcp/dashboard/*`

| Method | Path       | Description                                                    |
| ------ | ---------- | -------------------------------------------------------------- |
| `GET`  | `/health`  | Liveness check (no auth)                                       |
| `GET`  | `/agents`  | List all PM2-managed Agent Lee processes                       |
| `GET`  | `/metrics` | Backend system-status pass-through                             |
| `POST` | `/restart` | Restart a PM2 service by name (`{ "name": "AgentLee-Brain" }`) |

Example:

```powershell
$h = "AGENT_LEE_SOVEREIGN_V1"

# List agents
curl -H "x-neural-handshake: $h" http://127.0.0.1:7001/api/mcp/dashboard/agents

# Restart the Brain service
curl -X POST -H "x-neural-handshake: $h" -H "Content-Type: application/json" `
  -d '{"name":"AgentLee-Brain"}' `
  http://127.0.0.1:7001/api/mcp/dashboard/restart
```

---

### Browser MCP — `/api/mcp/browser/*`

| Method | Path        | Description                                                |
| ------ | ----------- | ---------------------------------------------------------- |
| `GET`  | `/health`   | Liveness check (no auth)                                   |
| `GET`  | `/status`   | List recent browser jobs                                   |
| `POST` | `/navigate` | Open URL, return title + text (`{ "url": "https://..." }`) |
| `POST` | `/scrape`   | Full page text + links (`{ "url": "https://..." }`)        |
| `GET`  | `/jobs/:id` | Poll a job by id                                           |

Example:

```powershell
$h = "AGENT_LEE_SOVEREIGN_V1"

# Navigate and get page title
$r = curl -X POST -H "x-neural-handshake: $h" -H "Content-Type: application/json" `
  -d '{"url":"https://example.com"}' `
  http://127.0.0.1:7001/api/mcp/browser/navigate | ConvertFrom-Json

# Poll the job (navigate is async)
curl -H "x-neural-handshake: $h" "http://127.0.0.1:7001/api/mcp/browser/jobs/$($r.jobId)"
```

---

## Optional — Add UI buttons to SystemHub

Paste this React snippet into `.Agent_Lee_OS/components/SystemHub.tsx` (or whichever panel you want):

```tsx
const [dashAgents, setDashAgents] = useState<any[]>([]);

const openDashboard = async () => {
  const res = await fetch("/api/mcp/dashboard/agents", {
    headers: { "x-neural-handshake": handshake },
  });
  const data = await res.json();
  setDashAgents(data.agents ?? []);
};

const openBrowser = async (url: string) => {
  const res = await fetch("/api/mcp/browser/navigate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-neural-handshake": handshake,
    },
    body: JSON.stringify({ url }),
  });
  const job = await res.json();
  console.log("Browser job started:", job.jobId);
};
```

---

## PWA Companion — Changes Applied

| File                                             | Change                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `workspace/agentlee_vm/manifest.json`            | `start_url` → `https://agentlee.rapidwebdevelop.com/workspace/agentlee_vm/agent-lee-companion.html` |
| `workspace/agentlee_vm/agent-lee-companion.html` | `SERVER` fallback → `https://agentlee.rapidwebdevelop.com`                                          |
| `workspace/agentlee_vm/agent-lee-companion.html` | Viewport: removed `maximum-scale=1.0, user-scalable=no`                                             |
| `workspace/agentlee_vm/agent-lee-companion.html` | Added `<link rel="apple-touch-icon" ...>`                                                           |
| `workspace/agentlee_vm/agent-lee-companion.html` | Added `-webkit-user-select: none` vendor prefix                                                     |

> Existing installs that already have `al_server` in `localStorage` will not be affected by the fallback change. To push the new default: clear site data on the device and reinstall the PWA from `https://agentlee.rapidwebdevelop.com/workspace/agentlee_vm/agent-lee-companion.html`.

---

## Port Map

| Port     | Service                       |
| -------- | ----------------------------- |
| 7000     | AgentLee-Frontend (Vite)      |
| 7001     | AgentLee-Backend (Express)    |
| 7002     | AgentLee-Bridge (MCP bridge)  |
| 7003     | AgentLee-Backend WS           |
| 7004     | AgentLee Neural Router        |
| 7005     | AgentLee-Hands (vision agent) |
| 7006     | AgentLee-PhoneBridge          |
| 7007     | AgentLee-InsForgeBridge       |
| **7008** | **AgentLee-DashboardMCP**     |
| **7009** | **AgentLee-BrowserMCP**       |
