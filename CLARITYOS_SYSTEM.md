<!-- LEEWAY HEADER BLOCK -->
<!-- File: CLARITYOS_SYSTEM.md -->
<!-- Purpose: Agent Lee OS clarity system documentation -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Optimized for sovereign agentic clarity system -->
<!-- Discovery: Part of Agent Lee OS compliance and evidence pipeline -->

# ClarityOS — System Reference & Connection Guide

> **Agent Lee's permanent meeting place with GitHub Copilot**
> Last updated: 2026-02-21 | Location: `C:\Tools\Portable-VSCode-MCP-Kit\CLARITYOS_SYSTEM.md`

---

## 1. What This Is

ClarityOS is a permanently-live local infrastructure that gives Agent Lee and GitHub Copilot a shared workspace where they can:

- Exchange data, tasks, thoughts, and event logs through a persistent UI
- Talk directly through a local AI chat API bridge (port 3500)
- Use 5 always-on MCP tool servers (Chrome DevTools, InsForge, Stitch, TestSprite, Spline)
- Build, commit, and deploy applications autonomously without manual approval prompts

Everything auto-starts silently at Windows login. No manual setup is needed after initial install.

---

## 2. The Full Stack At a Glance

`````text
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
    ├── clarity-chat-api   (ID 32)  :3500  ← Agent Lee ↔ GitHub Copilot (gpt-4o)
    ├── clarity-watchdog   (ID 34)         ← Health watchdog, checks every 60s
    ├── mcp-chrome-devtools(ID 27)  :4101  ← Browser automation
    ├── mcp-insforge       (ID 28)  :4102  ← InsForge cloud services
    ├── mcp-stitch         (ID 29)  :4103  ← UI design / Stitch
    ├── mcp-testsprite     (ID 30)  :4104  ← Test plan generation
    ├── mcp-spline         (ID 31)  :4105  ← 3D Spline assets
    └── (+ existing AgentLee-* processes ID 0-9, 21)

VS Code (GitHub Copilot)
    │  reads  C:\Users\Agent Lee\AppData\Roaming\Code\User\mcp.json
    │  connects to all 5 SSE endpoints on startup
    │  autoApprove: ["*"] on all tools — no permission prompts
    │
    └── ClarityOS UI  [http://localhost:5500](http://localhost:5500)
            ├── Tasks panel
            ├── Thoughts panel
            ├── Event Log + Lessons Learned
            ├── Insights dashboard
            └── 🤖 Chat AI tab  →  localhost:3500  →  GitHub Copilot (gpt-4o)
```text

---

## 3. File Locations (Full Map)

| What                       | Path                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **This file**              | `C:\Tools\Portable-VSCode-MCP-Kit\CLARITYOS_SYSTEM.md`                                                       |
| **ClarityOS UI**           | `C:\clarity-app\index.html`                                                                                  |
| **Chat API server**        | `C:\clarity-chat-api\server.js`                                                                              |
| **Chat API config**        | `C:\clarity-chat-api\config.json` (auto-created)                                                             |
| **Watchdog script**        | `C:\clarity-chat-api\watchdog.cjs`                                                                           |
| **PM2 ecosystem**          | `C:\MCP-Servers\ecosystem.config.js`                                                                         |
| **PM2 auto-start cmd**     | `C:\MCP-Servers\start-mcp-servers.cmd`                                                                       |
| **Silent VBS launcher**    | `C:\MCP-Servers\start-mcp-silent.vbs`                                                                        |
| **Windows Startup entry**  | `C:\Users\Agent Lee\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\ClarityOS-MCP-Servers.vbs` |
| **VS Code MCP config**     | `C:\Users\Agent Lee\AppData\Roaming\Code\User\mcp.json`                                                      |
| **VS Code settings**       | `C:\Users\Agent Lee\AppData\Roaming\Code\User\settings.json`                                                 |
| **supergateway (patched)** | `C:\Users\Agent Lee\AppData\Roaming\npm\node_modules\supergateway\dist\gateways\stdioToSse.js`               |
| **MCP run scripts**        | `C:\MCP-Servers\run-*.cmd`                                                                                   |
| **PM2 saved dump**         | `C:\Users\Agent Lee\.pm2\dump.pm2`                                                                           |
| **Node.js**                | `C:\Program Files\node-v22.17.1-win-x64\node.exe`                                                            |
| **PM2 binary**             | `C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2`                                                  |

---

## 4. The Meeting Point — How Agent Lee Connects to AI

### Default: GitHub Copilot via GitHub Models (no key needed)

The chat API (port 3500) is pre-configured to use the **GitHub Models** inference endpoint
([https://models.inference.ai.azure.com](https://models.inference.ai.azure.com)) which:

- Reads the existing `gh auth token` automatically — no new login, no API key
- Uses `gpt-4o` by default (same GitHub/OpenAI models backing VS Code Copilot)
- Is fully OpenAI-compatible (streaming, history, system prompt all work)

Available models on this endpoint (confirmed, free with GitHub account):

- `gpt-4o` ← **default**
- `gpt-4o-mini`
- `Meta-Llama-3.1-405B-Instruct`
- `Meta-Llama-3.1-70B-Instruct`
- `Meta-Llama-3.1-8B-Instruct`
- `Mistral-large-2407`
- `Mistral-Nemo`
- `AI21-Jamba-Instruct`

### 4a. From the ClarityOS UI (browser)

1. Open browser → [http://localhost:5500](http://localhost:5500)
2. Click **🤖 Chat AI** tab — provider is pre-set to "✨ GitHub Copilot (no key needed)"
3. Type in the chat box → streaming AI response appears token by token

To change model: click **⚙ Settings**, edit the model field, Save.

### 4b. Direct API — from any app, script, or tool

The chat API is always live at [http://127.0.0.1:3500](http://127.0.0.1:3500).

#### Simple chat call (PowerShell)

````powershell
$body = '{"message":"What tasks should Agent Lee focus on today?","history":[]}'
Invoke-RestMethod "[http://127.0.0.1:3500/api/chat](http://127.0.0.1:3500/api/chat)" -Method POST `
    -ContentType "application/json" -Body $body
# Returns: { reply: "...", model: "gpt-4o", provider: "github-copilot" }
```powershell

#### Streaming chat (JavaScript fetch)

```javascript
const res = await fetch("[http://127.0.0.1:3500/api/chat/stream](http://127.0.0.1:3500/api/chat/stream)", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Summarize my event log", history: [] }),
});
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  for (const part of buf.split("\n\n").slice(0, -1)) {
    const ev = part.match(/^event: (\w+)/)?.[1];
    const data = JSON.parse(part.match(/\ndata: (.+)/)?.[1] || "{}");
    if (ev === "token") process.stdout.write(data.text);
    if (ev === "done") console.log("\n[done]");
    if (ev === "error") console.error(data.error);
  }
}
```javascript

#### Health check

```text
GET [http://127.0.0.1:3500/health](http://127.0.0.1:3500/health)
→ { "status": "ok", "port": 3500, "provider": "github-copilot", "model": "gpt-4o", "ts": "..." }
`````

---

## 5. AI Provider Setup (Choose One)

### Option A — GitHub Copilot via GitHub Models (DEFAULT — no key needed)

Already configured. Uses `gh auth token` automatically.

- Provider: `github-copilot`
- Default model: `gpt-4o`
- Endpoint: [https://models.inference.ai.azure.com](https://models.inference.ai.azure.com)
- No setup required. Just works.

To switch model via the API:

```powershell
Invoke-RestMethod "[http://127.0.0.1:3500/api/config](http://127.0.0.1:3500/api/config)" -Method POST `
  -ContentType "application/json" `
  -Body '{"copilotModel":"Meta-Llama-3.1-70B-Instruct"}'
```

### Option B — Free: OpenRouter

1. Go to [https://openrouter.ai](https://openrouter.ai) → create free account → copy API key
2. POST to config: `{"provider":"openrouter","openrouterKey":"sk-or-...","openrouterModel":"meta-llama/llama-3.1-8b-instruct:free"}`

Free models: `google/gemma-3-27b-it:free`, `mistralai/mistral-7b-instruct:free`, `deepseek/deepseek-r1:free`

### Option C — Local: Ollama (fully private, no key, no internet)

1. Download Ollama from [https://ollama.com](https://ollama.com)
2. Run: `ollama pull llama3.2`
3. POST to config: `{"provider":"ollama","ollamaModel":"llama3.2"}`

### Option D — OpenAI

POST to config: `{"provider":"openai","openaiKey":"sk-...","openaiModel":"gpt-4o-mini"}`

### Option E — Anthropic

POST to config: `{"provider":"anthropic","anthropicKey":"...","anthropicModel":"claude-3-haiku-20240307"}`

---

## 6. MCP Servers — Connection Detail

All 5 MCPs connect to VS Code automatically. Defined in `mcp.json` with `autoApprove: ["*"]`.

| Name                  | PM2 ID | SSE Port | What it does                                      |
| --------------------- | ------ | -------- | ------------------------------------------------- |
| `mcp-chrome-devtools` | 27     | 4101     | Browser automation, screenshots, console, network |
| `mcp-insforge`        | 28     | 4102     | InsForge cloud: deploy, storage, edge functions   |
| `mcp-stitch`          | 29     | 4103     | UI design generation, screen edit, variants       |
| `mcp-testsprite`      | 30     | 4104     | Test plan generation, frontend/backend testing    |
| `mcp-spline`          | 31     | 4105     | 3D object creation, Spline editor tooling         |
| `clarity-chat-api`    | 32     | 3500     | **Agent Lee ↔ AI direct link**                    |
| `clarity-watchdog`    | 34     | —        | Health watchdog, auto-restarts dead services      |

### Quick health check (run anytime)

````powershell
3500,4101,4102,4103,4104,4105 | ForEach-Object {
    $p=$_; $t=New-Object Net.Sockets.TcpClient
    try{$t.Connect("127.0.0.1",$p);"$p OPEN"}catch{"$p CLOSED"}finally{$t.Dispose()}
}
```powershell

---

## 7. VS Code Auto-Connection Config

### `C:\Users\Agent Lee\AppData\Roaming\Code\User\mcp.json`

```json
{
  "servers": {
    "io.github.ChromeDevTools/chrome-devtools-mcp": {
      "type": "sse",
      "url": "[http://127.0.0.1:4101/sse](http://127.0.0.1:4101/sse)",
      "autoApprove": ["*"]
    },
    "io.github.InsForge/insforge-mcp": {
      "type": "sse",
      "url": "[http://127.0.0.1:4102/sse](http://127.0.0.1:4102/sse)",
      "autoApprove": ["*"]
    },
    "stitch-mcp": {
      "type": "sse",
      "url": "[http://127.0.0.1:4103/sse](http://127.0.0.1:4103/sse)",
      "autoApprove": ["*"]
    },
    "cigro/testsprite-mcp": {
      "type": "sse",
      "url": "[http://127.0.0.1:4104/sse](http://127.0.0.1:4104/sse)",
      "autoApprove": ["*"]
    },
    "spline-mcp": {
      "type": "sse",
      "url": "[http://127.0.0.1:4105/sse](http://127.0.0.1:4105/sse)",
      "autoApprove": ["*"]
    }
  },
  "inputs": []
}
```text

### `C:\Users\Agent Lee\AppData\Roaming\Code\User\settings.json`

```json
{
  "chat.tools.terminal.autoApprove": true,
  "chat.mcp.discovery.enabled": {
    "claude-desktop": true,
    "windsurf": true,
    "cursor-global": true,
    "cursor-workspace": true
  },
  "chat.agent.maxRequests": 200,
  "github.copilot.chat.agent.runTool.autoApprove": true,
  "github.copilot.chat.runCommand.enabled": true,
  "github.copilot.chat.codesearch.enabled": true,
  "github.copilot.chat.edits.enabled": true,
  "github.copilot.chat.agent.terminal.allowList": ["*"],
  "workbench.commandPalette.experimental.askChatLocation": "quickChat"
}
```powershell

---

## 8. Auto-Start Chain (How Everything Stays Alive)

Windows Login
↓
C:\Users\Agent Lee\AppData\Roaming\Microsoft\Windows\
 Start Menu\Programs\Startup\ClarityOS-MCP-Servers.vbs
↓ (silent, no console window)
C:\MCP-Servers\start-mcp-servers.cmd
↓
node pm2 resurrect ← restores last-saved process list
node pm2 start ecosystem.config.js ← starts any that didn't restore
node pm2 save ← saves current state for next boot
↓
PM2 keeps all processes alive with autorestart: true
↓
clarity-watchdog (PM2 ID 34): C:\clarity-chat-api\watchdog.cjs
↓ checks every 60 seconds
↓ restarts any offline MCP server or chat API
↓ logs to C:\MCP-Servers\logs\watchdog.log

````

---

## 9. Troubleshooting

### "MCP server starting…" appears briefly in VS Code

Normal — VS Code connects to each SSE endpoint and each spawns a fresh child process.
Should resolve in 1-2 seconds. If it loops/hangs indefinitely, the supergateway fix may
have been overwritten (see Section 10).

### Chat API not responding (port 3500 offline)

```powershell
$node = "C:\Program Files\node-v22.17.1-win-x64\node.exe"
$pm2  = "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2"
& $node $pm2 restart clarity-chat-api
```

### GitHub Copilot provider returns auth error

The `gh` CLI token expired or gh isn't authenticated:

```powershell
gh auth status          # check current auth
gh auth login           # re-authenticate if needed
gh auth token           # verify token is returned
```

Then restart: `& $node $pm2 restart clarity-chat-api`

### All MCPs offline after reboot

The startup VBS may have failed. Run manually:

```powershell
& "C:\MCP-Servers\start-mcp-servers.cmd"
```

### Restart everything from scratch

```powershell
$node = "C:\Program Files\node-v22.17.1-win-x64\node.exe"
$pm2  = "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2"
& $node $pm2 restart all
& $node $pm2 save
```

---

## 10. supergateway Patch — Critical Fix

**File:** `C:\Users\Agent Lee\AppData\Roaming\npm\node_modules\supergateway\dist\gateways\stdioToSse.js`

**Why it's patched (twice):**

**Fix 1** — "Already connected to transport" crash  
Original code shared one `Server` instance. Fixed by creating a new `Server` per SSE connection.

**Fix 2** — Multiple VS Code windows corrupt each other's MCP handshakes  
Original code spawned ONE child process shared by all connections. When Window 2 connected
and sent `initialize`, the child's response was broadcast to ALL sessions including Window 1,
breaking both. Fixed by spawning a **dedicated child process per SSE connection** — fully
isolated, no cross-session broadcast.

Current architecture (as of 2026-02-21):

- `app.get('/sse', ...)` → spawn new child → new Server → new SSEServerTransport
- Child stdout routes ONLY back to its own session
- On disconnect: child is killed, session cleaned up
- Multiple simultaneous VS Code instances work independently

**If supergateway is updated/reinstalled**, re-apply the fix by running:

````powershell
# The fixed version is the content currently in stdioToSse.js
# Back it up first
Copy-Item "...stdioToSse.js" "...stdioToSse.js.bak"
```powershell

The current fixed file has 137 lines and starts with `import express from 'express';`.

---

## 11. ClarityOS Chat API Endpoints Reference

Base URL: [http://127.0.0.1:3500](http://127.0.0.1:3500)

| Method | Endpoint           | Body                     | Returns                                          |
| ------ | ------------------ | ------------------------ | ------------------------------------------------ |
| GET    | `/health`          | —                        | `{ status, port, provider, model, ts }`          |
| GET    | `/api/config`      | —                        | Current config (keys masked) + `copilotModels[]` |
| POST   | `/api/config`      | Any config fields        | `{ ok: true }`                                   |
| POST   | `/api/chat`        | `{ message, history[] }` | `{ reply, model, provider }`                     |
| POST   | `/api/chat/stream` | `{ message, history[] }` | SSE: `start`, `token`, `done`, `error` events    |
| GET    | `/api/models`      | —                        | Array of model names for current provider        |

---

## 12. Adding This Chat API to Any UI

```html
<script>
  const CLARITY_API = "[http://127.0.0.1:3500](http://127.0.0.1:3500)";

  async function askClarityAI(message, history = []) {
    const res = await fetch(`${CLARITY_API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    const { reply } = await res.json();
    return reply;
  }

  async function askClarityAIStream(message, history = [], onToken, onDone) {
    const res = await fetch(`${CLARITY_API}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        const ev = part.match(/^event: (\w+)/)?.[1];
        const data = JSON.parse(part.match(/\ndata: (.+)/)?.[1] || "{}");
        if (ev === "token" && data.text) onToken(data.text);
        if (ev === "done") onDone?.();
      }
    }
  }
</script>
````

---

## 13. ClarityOS UI Features

URL: [http://localhost:5500](http://localhost:5500)
Source: `C:\clarity-app\index.html` (single file, no build step)

| Tab          | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| 🎯 Tasks     | Add/complete tasks with priority, tags, notes. Ctrl+Enter to save.   |
| 💡 Thoughts  | Brain dump capture with mood tagging. Promote any thought to a Task. |
| 📋 Event Log | Log sessions/incidents. Each entry has a **Lesson Learned** field.   |
| 🧠 Insights  | Live stats, top tags, mood breakdown, all lessons in one feed.       |
| 🤖 Chat AI   | Streaming AI chat via GitHub Copilot (gpt-4o). No key needed.        |

All data persists in browser localStorage. Export any panel to JSON.

---

## 14. Git Repositories

### ClarityOS UI: `C:\clarity-app\.git`

Commits:

- `4c6e973` — initial Clarity app (tasks, thoughts, events, insights)
- `7535c98` — Chat AI tab + streaming API bridge
- `0fae421` — GitHub Copilot provider as default, index.html UI update

### Chat API: `C:\clarity-chat-api\.git`

Commits:

- `0fd9d3c` — server.js with github-copilot provider (gpt-4o via GitHub Models)

---

## 15. Quick Commands Cheat Sheet

```powershell
# Start everything
& "C:\MCP-Servers\start-mcp-servers.cmd"

# Check all processes
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" ls

# TCP port check (doesn't hang on SSE streams)
4101,4102,4103,4104,4105 | ForEach-Object { $p=$_; $t=New-Object Net.Sockets.TcpClient; try{$t.Connect("127.0.0.1",$p);"$p OPEN"}catch{"$p CLOSED"}finally{$t.Dispose()} }

# Restart one server
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" restart clarity-chat-api

# Restart all
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" restart all

# View live logs
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" "C:\Tools\Portable-VSCode-MCP-Kit\node_modules\pm2\bin\pm2" logs clarity-chat-api --lines 30

# Test chat API
Invoke-RestMethod "[http://127.0.0.1:3500/api/chat](http://127.0.0.1:3500/api/chat)" -Method POST -ContentType "application/json" -Body '{"message":"Hello from Agent Lee","history":[]}'

# Check current AI provider
Invoke-RestMethod "[http://127.0.0.1:3500/health](http://127.0.0.1:3500/health)"

# Switch to a different model (GitHub Models)
Invoke-RestMethod "http://127.0.0.1:3500/api/config" -Method POST -ContentType "application/json" -Body '{"copilotModel":"Meta-Llama-3.1-70B-Instruct"}'

# Open ClarityOS UI
Start-Process "http://localhost:5500"
```

---

_ClarityOS — built by GitHub Copilot for Agent Lee_
_Permanent link, always live, auto-starts at login._
