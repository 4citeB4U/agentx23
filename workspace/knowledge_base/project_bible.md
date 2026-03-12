# Agent Lee OS — Project Bible

**Version:** 5.0 — Updated 2026-02-20
**Status:** LIVE — all services online
**Classification:** Sovereign Intelligence Stack

---

## 1. Mission

Agent Lee is a sovereign, self-improving AI operating system running entirely on local hardware.
No cloud reasoning. No cloud storage. No external dependencies for intelligence.
Gemini is restricted to voice synthesis (TTS Tier 2) only.
Qwen2.5 via Ollama is the sole reasoning engine.

---

## 2. Port Map

| Port | Service           | PM2 Name                | Script                           |
| ---- | ----------------- | ----------------------- | -------------------------------- |
| 6000 | Frontend (Vite)   | AgentLee-Frontend       | node_modules/vite/bin/vite.js    |
| 6001 | Backend (Express) | AgentLee-Backend        | backend/dist/index.js            |
| 6002 | MCP Bridge        | AgentLee-Bridge         | vscode-mcp-tooling/src/bridge.js |
| 6003 | WebSocket         | (part of Backend)       | backend/src/ws.ts                |
| 6004 | Brain (FastAPI)   | AgentLee-Brain          | server.py                        |
| 6005 | Vision Agent      | AgentLee-Hands          | scripts/vision_agent.py          |
| 8007 | PocketTTS         | AgentLee-PocketTTS      | scripts/pocket_tts_server.py     |
| 8008 | Phone Bridge      | AgentLee-PhoneBridge    | phone-bridge/dist/index.js       |
| 7130 | InsForgeBridge    | AgentLee-InsForgeBridge | InsForge extension bridge        |
| N/A  | Cloudflare Tunnel | AgentLee-Tunnel         | cloudflared.exe -> :8001         |
| N/A  | Caffeine          | AgentLee-Caffeine       | scripts/caffeine.py              |

---

## 3. PM2 Process Tree (10 processes)

```
AgentLee-Brain          online  port 6004   server.py (FastAPI + Qwen)
AgentLee-Backend        online  port 6001   backend/dist/index.js (Express)
AgentLee-Frontend       stopped port 6000   Vite build (one-shot, autorestart:false)
AgentLee-Bridge         online  port 6002   vscode-mcp-tooling/src/bridge.js
AgentLee-Hands          online  port 6005   scripts/vision_agent.py  <- NEW
AgentLee-Caffeine       online  --          scripts/caffeine.py
AgentLee-Tunnel         online  --          cloudflared -> :8001
AgentLee-PhoneBridge    online  port 8008   phone-bridge/dist/index.js
AgentLee-InsForgeBridge online  port 7130   InsForge bridge
AgentLee-PocketTTS      online  port 8007   scripts/pocket_tts_server.py
```

---

## 4. Intelligence Stack

### 4.1 Reasoning Engine

- **Model:** qwen2.5:latest via Ollama (port 11434)
- ONLY reasoning engine — Gemini is NOT used for chat/reasoning
- Execution modes: single_pass | multi_pass (Planner->Executor->Reviewer->Safety)
- Domain adapters: qwen_general | qwen_code | qwen_ui | qwen_cdl
- Adapter routing: auto-classified per request domain

### 4.2 TTS Voice Chain (3-tier)

| Tier | Engine             | Status   | Notes                                    |
| ---- | ------------------ | -------- | ---------------------------------------- |
| 1    | PocketTTS (Marius) | Primary  | Local, port 8007, ffmpeg 1.292x pitch    |
| 2    | Gemini TTS         | Fallback | gemini-2.5-flash-preview-tts, voice=Orus |
| 3    | edge-tts           | Last     | en-US-GuyNeural                          |

### 4.3 Perception Layer (v5 — Phase 1)

- **vision_agent.py** (port 8005) replaces desktop_agent.py
  - Routes: /health, /status, /screen, /act, /analyze, /stream/start, /stream/stop, /stream/state
  - Camera loop: 2 FPS default, 0.5 FPS when CPU > 80%
  - BLIP caption stubs + MobileNet object detection stubs (ONNX-ready)
  - OpenCV lighting detection (brightness mean, no model)
- **brain/modules/vision_context.py** — pulls snapshot from :8005/stream/state (max 30s stale)
- **brain/modules/emotional_engine.py** — regex keyword scoring (stress/fatigue/urgency/frustration)
- **brain/modules/context_enricher.py** — augments prompts with [ENVIRONMENT] + [EMOTIONAL_STATE] blocks

---

## 5. Brain Routes (server.py — port 8004)

| Method | Path            | Auth               | Description                           |
| ------ | --------------- | ------------------ | ------------------------------------- |
| GET    | /health         | None               | System status + feature flags         |
| POST   | /chat           | X-Neural-Handshake | Main reasoning endpoint (Qwen only)   |
| POST   | /tts            | None               | 3-tier TTS chain -> WAV stream        |
| GET    | /episodes       | Handshake          | Episode DB query                      |
| GET    | /reward-stats   | None               | Reward engine analytics               |
| POST   | /mission/add    | Handshake          | Add mission to queue                  |
| GET    | /mission/queue  | Handshake          | List pending missions                 |
| POST   | /retrain/submit | Handshake          | Submit episode for fine-tuning corpus |
| GET    | /drift/report   | None               | Drift analytics report                |

### /chat perception injection (v5)

Every /chat request now:

1. Pulls GET :8005/stream/state (non-blocking, 3s timeout, fails silently)
2. Scores user text -> {stress, fatigue, urgency, frustration} via emotional_engine
3. Prepends [ENVIRONMENT] + [EMOTIONAL_STATE] blocks to augmented_prompt
4. Passes emotion_score to compute_reward() for urgency-weighted rewards

---

## 6. Reward Engine

```
R = (code_pass_rate x 0.4) + (correctness x 0.3) + (depth_score x 0.2) - (penalty x 0.1)
R = R x (1 + (urgency + stress) x 0.05)   <- emotional weight (v5)
```

- depth_score = min(planning_depth / 5.0, 1.0)
- penalty = min(hallucination_flags x 0.25, 1.0)
- SYNTHETIC_THRESHOLD = 0.75 — episodes above this trigger synthetic expansion

---

## 7. Episode DB (SQLite)

**Path:** workspace/episodes.db
**Key columns:** id, user_id, domain, adapter_used, execution_mode, reward_score, model_used, created_at

---

## 8. Frontend (port 8000)

React + TypeScript + Vite. Key components:

| Component            | Purpose                         |
| -------------------- | ------------------------------- |
| VoxelCore            | Three.js 15k-voxel 3D avatar    |
| MatrixView           | 25fps live desktop viewer       |
| MemoryLake           | 8-drive-alias file browser      |
| TelemetryDashboard   | Real-time system metrics        |
| UnifiedCommandBar    | Main chat + command interface   |
| SovereignSidebar     | Navigation + service status     |
| GenesisEnginePanel   | Episode / reward analytics      |
| DeployPanel          | File deployment UI              |
| SettingsControlTower | Environment + config management |

SovereignIdentity service HMAC-signs all API requests from browser.

---

## 9. Security

- Neural Handshake: All privileged routes require X-Neural-Handshake: AGENT_LEE_SOVEREIGN_V1
- HMAC: All filesystem mutations on /api/fs/write signed with HMAC-SHA256
- Audit Log: All FS mutations logged to backend/logs/
- Path traversal: Allowlisted drive aliases only — no absolute paths from client
- Gemini keys: Only used for TTS Tier 2 — never for reasoning

---

## 10. Operational Commands

```powershell
# PM2 status
.\node_modules\.bin\pm2.cmd list

# Reload a service from ecosystem
.\node_modules\.bin\pm2.cmd startOrReload ecosystem.config.cjs --only AgentLee-Brain

# Brain logs
.\node_modules\.bin\pm2.cmd logs AgentLee-Brain --lines 50 --nostream

# Start perception stream
Invoke-RestMethod -Method POST http://127.0.0.1:6005/stream/start

# Test chat
Invoke-RestMethod -Method POST http://127.0.0.1:6004/chat `
  -ContentType application/json `
  -Body '{"prompt":"status check","handshake":"AGENT_LEE_SOVEREIGN_V1"}'

# Test TTS
Invoke-RestMethod -Method POST http://127.0.0.1:8007/tts `
  -ContentType application/json `
  -Body '{"text":"Agent Lee online."}' -OutFile test.wav

# pip (venv)
C:/Tools/Portable-VSCode-MCP-Kit/.venv/Scripts/pip.exe install <package>
```

---

## 11. Known Gaps / Next Phase

| Gap                        | Plan                                          | Phase |
| -------------------------- | --------------------------------------------- | ----- |
| BLIP captions are stubs    | Drop in BLIP-Base ONNX session                | 2     |
| MobileNet stubs            | Drop in MobileNetV3-Large ONNX session        | 2     |
| Emotional engine is regex  | Train lightweight classifier on episode data  | 3     |
| Reward model is rule-based | Bradley-Terry preference learning             | 4     |
| No phone camera feed       | Phone Bridge -> vision_agent /stream endpoint | 3     |
| Gemini TTS quota           | PocketTTS Tier 1 handles ~95% load            | Done  |

---

_Last updated by GitHub Copilot — 2026-02-20 — perception layer v1 shipped_
