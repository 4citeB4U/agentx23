# ClarityOS — System Reference & Connection Guide
> **Agent Lee's permanent meeting place with GitHub Copilot (Claude Sonnet 4.6)**
> Last updated: 2026-02-21 | Location: `C:\Tools\Portable-VSCode-MCP-Kit\CLARITYOS_SYSTEM.md`

---

## 1. What This Is

ClarityOS is a permanently-live local infrastructure that gives Agent Lee and GitHub Copilot a shared workspace where they can:

- Exchange data, tasks, thoughts, and event logs through a persistent UI
- Talk directly through a local AI chat API bridge (port 3500)
- Use 5 always-on MCP tool servers (InsForge, Chrome DevTools, Stitch, TestSprite, Spline)
- Build, commit, and deploy applications autonomously without manual approval prompts

Everything auto-starts silently at Windows login. No manual setup is needed after initial install.

---

## 2. The Full Stack At a Glance

```
Windows Login
    │
    ▼
ClarityOS-MCP-Servers.vbs  (Windows Startup folder — silent, no console)
    │
    ▼
start-mcp-servers.cmd  (C:\MCP-Servers\)
    │  PM2 resurrect → PM2 start ecosystem.config.js
    ▼
PM2 Process Manager  (C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2)
    │
    ├── clarity-chat-api          :3500  ← Agent Lee ↔ AI meeting point
    ├── mcp-chrome-devtools   SSE :4101  ← Browser automation
    ├── mcp-insforge          SSE :4102  ← InsForge cloud services
    ├── mcp-stitch            SSE :4103  ← UI design / Stitch
    ├── mcp-testsprite        SSE :4104  ← Test plan generation
    ├── mcp-spline            SSE :4105  ← 3D Spline assets
    └── (+ existing AgentLee-* processes ID 0-9, 21)

VS Code (GitHub Copilot + Claude Sonnet 4.6)
    │  reads  C:\Users\Agent Lee\AppData\Roaming\Code\User\mcp.json
    │  connects to all 5 SSE endpoints on startup
    │  autoApprove: ["*"] on all tools — no permission prompts
    │
    └── ClarityOS UI  http://localhost:5500
            ├── Tasks panel
            ├── Thoughts panel
            ├── Event Log + Lessons Learned
            ├── Insights dashboard
            └── 🤖 Chat AI tab  →  localhost:3500  →  AI provider
```

---

## 3. File Locations (Full Map)

| What | Path |
|---|---|
| **This file** | `C:\Tools\Portable-VSCode-MCP-Kit\CLARITYOS_SYSTEM.md` |
| **ClarityOS UI** | `C:\clarity-app\index.html` |
| **Chat API server** | `C:\clarity-chat-api\server.js` |
| **Chat API config** | `C:\clarity-chat-api\config.json` (auto-created) |
| **PM2 ecosystem** | `C:\MCP-Servers\ecosystem.config.js` |
| **PM2 auto-start cmd** | `C:\MCP-Servers\start-mcp-servers.cmd` |
| **Silent VBS launcher** | `C:\MCP-Servers\start-mcp-silent.vbs` |
| **Windows Startup entry** | `C:\Users\Agent Lee\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\ClarityOS-MCP-Servers.vbs` |
| **VS Code MCP config** | `C:\Users\Agent Lee\AppData\Roaming\Code\User\mcp.json` |
| **VS Code settings** | `C:\Users\Agent Lee\AppData\Roaming\Code\User\settings.json` |
| **supergateway (patched)** | `C:\Users\Agent Lee\AppData\Roaming\npm\node_modules\supergateway\dist\gateways\stdioToSse.js` |
| **MCP run scripts** | `C:\MCP-Servers\run-*.cmd` |
| **PM2 saved dump** | `C:\Users\Agent Lee\.pm2\dump.pm2` |
| **Watchdog script** | `C:\Tools\Portable-VSCode-MCP-Kit\clarityos-watchdog.js` |
| **Node.js** | `C:\Program Files\node-v22.17.1-win-x64\node.exe` |
| **PM2 binary** | `C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2` |

---

## 4. The Meeting Point — How Agent Lee Connects to AI

### 4a. From the ClarityOS UI (browser)

1. Open browser → `http://localhost:5500`
2. Click **🤖 Chat AI** tab
3. Click **⚙ Settings**
4. Set provider + API key (see Section 5)
5. Click **Save Settings**
6. Type in the chat box → streaming AI response appears token by token

The chat remembers conversation history across refreshes (localStorage).

### 4b. Direct API — from any app, script, or tool

The chat API is always live at `http://127.0.0.1:3500`. Any application can call it.

#### Simple chat call (PowerShell):
```powershell
$body = '{"message":"What tasks should Agent Lee focus on today?","history":[]}'
Invoke-RestMethod "http://127.0.0.1:3500/api/chat" -Method POST `
    -ContentType "application/json" -Body $body
# Returns: { reply: "...", model: "...", provider: "..." }
```

#### Streaming chat (JavaScript fetch):
```javascript
const res = await fetch('http://127.0.0.1:3500/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Summarize my lessons learned this week',
    history: []  // optional: array of { role, content } pairs
  })
});

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  for (const part of buf.split('\n\n').slice(0,-1)) {
    const ev   = part.match(/^event: (\w+)/)?.[1];
    const data = JSON.parse(part.match(/\ndata: (.+)/)?.[1] || '{}');
    if (ev === 'token') process.stdout.write(data.text);  // or append to DOM
    if (ev === 'done')  console.log('\n[done]');
    if (ev === 'error') console.error(data.error);
  }
}
```

#### Get/set config (JavaScript):
```javascript
// Read current config (keys masked)
const cfg = await fetch('http://127.0.0.1:3500/api/config').then(r => r.json());

// Update provider and model
await fetch('http://127.0.0.1:3500/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'openrouter',
    openrouterKey: 'sk-or-...',
    openrouterModel: 'meta-llama/llama-3.1-8b-instruct:free',
    systemPrompt: 'You are ClarityOS...'
  })
});
```

#### Health check:
```
GET http://127.0.0.1:3500/health
→ { "status": "ok", "port": 3500, "ts": "2026-02-21T..." }
```

---

## 5. AI Provider Setup (Choose One)

### Option A — Free: OpenRouter (recommended to start)
1. Go to https://openrouter.ai → create free account → copy API key
2. In ClarityOS Chat ⚙ Settings: set Provider = OpenRouter, paste key, model = `meta-llama/llama-3.1-8b-instruct:free`
3. Click Save → start chatting (free, no card needed)

Other free OpenRouter models:
- `google/gemma-3-27b-it:free`
- `mistralai/mistral-7b-instruct:free`
- `deepseek/deepseek-r1:free`

### Option B — Local: Ollama (fully private, no key needed)
1. Download Ollama from https://ollama.com (already in Windows Startup as Ollama.lnk)
2. Run: `ollama pull llama3.2` (or `phi4`, `mistral`, etc.)
3. Ollama runs at `http://localhost:11434` automatically
4. In ClarityOS: Provider = Ollama, Model = `llama3.2`

### Option C — OpenAI
- Provider = OpenAI, Key = `sk-...`, Model = `gpt-4o-mini` or `gpt-4o`

### Option D — Anthropic
- Provider = Anthropic, Key = your Anthropic key, Model = `claude-3-haiku-20240307`

---

## 6. MCP Servers — Connection Detail

All 5 MCPs connect to VS Code automatically. They are defined in `mcp.json` with `autoApprove: ["*"]` meaning zero prompts — Copilot uses them instantly.

| Name | PM2 ID | SSE Port | What it does |
|---|---|---|---|
| `mcp-chrome-devtools` | 27 | 4101 | Browser automation, screenshots, console, network |
| `mcp-insforge` | 28 | 4102 | InsForge cloud: deploy, storage, edge functions |
| `mcp-stitch` | 29 | 4103 | UI design generation, screen edit, variants |
| `mcp-testsprite` | 30 | 4104 | Test plan generation, frontend/backend testing |
| `mcp-spline` | 31 | 4105 | 3D object creation, Spline editor tooling |
| `clarity-chat-api` | 32 | 3500 | **Agent Lee ↔ AI direct link** |

### Quick health check (run anytime):
```powershell
3500,4101,4102,4103,4104,4105 | ForEach-Object {
    try { $r = Invoke-WebRequest "http://127.0.0.1:$_/health" -TimeoutSec 3 -UseBasicParsing; "$_ : OK" }
    catch { "$_ : OFFLINE" }
}
```

---

## 7. VS Code Auto-Connection Config

### `C:\Users\Agent Lee\AppData\Roaming\Code\User\mcp.json`
```json
{
  "servers": {
    "io.github.ChromeDevTools/chrome-devtools-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:4101/sse",
      "autoApprove": ["*"]
    },
    "io.github.InsForge/insforge-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:4102/sse",
      "autoApprove": ["*"]
    },
    "stitch-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:4103/sse",
      "autoApprove": ["*"]
    },
    "cigro/testsprite-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:4104/sse",
      "autoApprove": ["*"]
    },
    "spline-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:4105/sse",
      "autoApprove": ["*"]
    }
  },
  "inputs": []
}
```

### `C:\Users\Agent Lee\AppData\Roaming\Code\User\settings.json` (relevant keys)
```json
{
  "chat.tools.terminal.autoApprove": true,
  "chat.mcp.discovery.enabled": true,
  "chat.agent.maxRequests": 200,
  "github.copilot.chat.agent.runTool.autoApprove": true,
  "github.copilot.chat.runCommand.enabled": true,
  "github.copilot.chat.edits.enabled": true,
  "github.copilot.chat.agent.terminal.allowList": ["*"]
}
```

---

## 8. Auto-Start Chain (How Everything Stays Alive)

```
Windows Login
    ↓
C:\Users\Agent Lee\AppData\Roaming\Microsoft\Windows\
    Start Menu\Programs\Startup\ClarityOS-MCP-Servers.vbs
    ↓  (silent, no console window)
C:\MCP-Servers\start-mcp-servers.cmd
    ↓
node pm2 resurrect              ← restores last-saved process list
node pm2 start ecosystem.config.js   ← starts any that didn't restore
node pm2 save                   ← saves current state for next boot
    ↓
PM2 keeps all processes alive with autorestart: true
    ↓
Watchdog (PM2 ID 33): clarityos-watchdog.js
    ↓  checks every 60 seconds
    ↓  restarts any offline MCP server
    ↓  logs to C:\MCP-Servers\logs\watchdog.log
```

---

## 9. Troubleshooting

### "MCP server starting…" appears in VS Code
The SSE servers aren't running yet. Fix:
```powershell
cd C:\MCP-Servers
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" start ecosystem.config.js
```
Then press **Refresh** on the MCP panel in VS Code.

### Chat API not responding (port 3500 offline)
```powershell
$node = "C:\Program Files\node-v22.17.1-win-x64\node.exe"
$pm2  = "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2"
& $node $pm2 restart clarity-chat-api
```

### All MCPs offline after reboot
The startup VBS may have failed. Run manually:
```powershell
& "C:\MCP-Servers\start-mcp-servers.cmd"
```

### supergateway "already connected" error returns
Re-patch the file:
```
File: C:\Users\Agent Lee\AppData\Roaming\npm\node_modules\supergateway\dist\gateways\stdioToSse.js
Fix: Move "new Server(...)" inside the app.get('/sse', ...) handler
     Each SSE connection must get its own Server instance
```

### Restart everything from scratch
```powershell
$node = "C:\Program Files\node-v22.17.1-win-x64\node.exe"
$pm2  = "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2"
& $node $pm2 restart all
& $node $pm2 save
```

---

## 10. ClarityOS Watchdog

Script: `C:\Tools\Portable-VSCode-MCP-Kit\clarityos-watchdog.js`
PM2 ID: 33 | Runs every 60 seconds | Logs: `C:\MCP-Servers\logs\watchdog.log`

Monitors ports: 3500, 4101, 4102, 4103, 4104, 4105
If any port stops responding → auto-restarts the matching PM2 process.

---

## 11. ClarityOS UI Features

URL: `http://localhost:5500`
Served by: Python http.server (PM2 managed)
Source: `C:\clarity-app\index.html` (single file, no build step)

| Tab | Purpose |
|---|---|
| 🎯 Tasks | Add/complete tasks with priority, tags, notes. Ctrl+Enter to save. |
| 💡 Thoughts | Brain dump capture with mood tagging. Promote any thought to a Task. |
| 📋 Event Log | Log sessions/incidents. Each entry has a **Lesson Learned** field. |
| 🧠 Insights | Live stats, top tags, mood breakdown, all lessons in one feed. |
| 🤖 Chat AI | Streaming AI chat connected to local API bridge at port 3500. |

All data persists in browser localStorage. Export any panel to JSON.
Keyboard: `Ctrl+Enter` saves in whichever panel is active.

---

## 12. Git Repository

ClarityOS UI: `C:\clarity-app\.git`
Commits:
- `4c6e973` — initial Clarity app (tasks, thoughts, events, insights)
- `7535c98` — Chat AI tab + streaming API bridge

To push to GitHub (when ready):
```bash
cd C:\clarity-app
git remote add origin https://github.com/AgentLee/<repo-name>.git
git push -u origin master
```

---

## 13. ClarityOS Chat API Endpoints Reference

Base URL: `http://127.0.0.1:3500`

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ status, port, ts }` |
| GET | `/api/config` | — | Current config (keys masked) |
| POST | `/api/config` | Any config fields | `{ ok: true }` |
| POST | `/api/chat` | `{ message, history[] }` | `{ reply, model, provider }` |
| POST | `/api/chat/stream` | `{ message, history[] }` | SSE: `start`, `token`, `done`, `error` events |
| GET | `/api/models` | — | Array of model names (Ollama/OpenRouter) |

---

## 14. Adding This Chat API to Any UI

Copy this snippet anywhere in your HTML/JS to add an AI chat to any page:

```html
<script>
// ClarityOS AI — drop-in chat for any page
// API is always live at localhost:3500
const CLARITY_API = 'http://127.0.0.1:3500';

async function askClarityAI(message, history = []) {
  const res = await fetch(`${CLARITY_API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });
  const { reply } = await res.json();
  return reply;
}

// Streaming version — onToken called for each word
async function askClarityAIStream(message, history = [], onToken, onDone) {
  const res = await fetch(`${CLARITY_API}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      const ev   = part.match(/^event: (\w+)/)?.[1];
      const data = JSON.parse(part.match(/\ndata: (.+)/)?.[1] || '{}');
      if (ev === 'token' && data.text) onToken(data.text);
      if (ev === 'done') onDone?.();
    }
  }
}

// Example usage:
// const reply = await askClarityAI("What should I work on today?");
// askClarityAIStream("Explain my last event log", [], tok => console.log(tok), () => console.log('done'));
</script>
```

---

## 15. Quick Commands Cheat Sheet

```powershell
# Start everything
& "C:\MCP-Servers\start-mcp-servers.cmd"

# Check all processes
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" ls

# Health check all ports
3500,4101,4102,4103,4104,4105 | % { try { (irm "http://127.0.0.1:$_/health" -TimeoutSec 2).status + " :$_" } catch { "OFFLINE :$_" } }

# Restart one server
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" restart clarity-chat-api

# Restart all
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" restart all

# View live logs (chat API)
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" logs clarity-chat-api --lines 30

# Open ClarityOS UI
Start-Process "http://localhost:5500"

# Test chat API directly
Invoke-RestMethod "http://127.0.0.1:3500/api/chat" -Method POST -ContentType "application/json" -Body '{"message":"Hello from Agent Lee","history":[]}'
```

---

*ClarityOS — built by GitHub Copilot (Claude Sonnet 4.6) for Agent Lee*
*Permanent link, always live, auto-starts at login.*
