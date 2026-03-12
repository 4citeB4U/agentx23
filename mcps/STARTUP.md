# Agent Lee OS — MCP Startup & Deployment Map

## Overview

Agent Lee is a sovereign kernel that dispatches all work to specialised MCP agents.
Each agent is an independent process communicating over **stdio** or **SSE** transport.

### Minimum Online Set (Basic Functionality)

| Agent                          | Required For                        |
| ------------------------------ | ----------------------------------- |
| `planner-agent-mcp`            | Any multi-step task / scheduling    |
| `memory-agent-mcp`             | Context recall, session continuity  |
| `scheduling-agent-mcp`         | Events, calendar, reminders         |
| `backend` (Express AI service) | HTTP routing, intent classification |

All other agents are **optional** — missing agents are logged and the kernel routes around them.

---

## Three-Path Routing Architecture

`backend/src/services/ai.ts` classifies every request into one of three execution paths:

```
FAST PATH   ── converse / speak_voice / translate_language
               → Gemini Flash direct (no memory, no Neural Router)
               → Sub-100ms target latency
               → GLM-Flash as backup if Gemini is down

SMART PATH  ── plan_task / orchestrate_agents / design_ui / generate_3d / test_system / schedule
               → GLM-4-Flash (reasoning/planning)
               → Gemini Flash narration if GLM-Flash unreachable
               → Target: < 3s end-to-end

ACTION PATH ── analyze_visual / recall_memory / write_memory /
               execute_terminal / automate_browser
               → Vision: GLM-4V-Flash (glm_vision lane)
               → Memory: NotebookLM → InsForge cache (7-day) → session store
               → Terminal/Browser: Neural Router → Desktop/Playwright MCP
               → requires_verification=TRUE for terminal + browser (host mutations)
               → Gemini / GLM-Flash as final fallback
```

### `requires_verification` Flag

When `requires_verification=true`, the caller **must** invoke `validation-agent-mcp:verify_result`
before returning the execution result to the user. Only `execute_terminal` and `automate_browser`
intents carry this flag — conversational queries never trigger validation overhead.

---

## Model Lane Assignments

| Lane         | Model               | Responsibilities                               |
| ------------ | ------------------- | ---------------------------------------------- |
| `gemini`     | Gemini 1.5 Flash    | Fast path voice/conversation/multilingual      |
| `glm_flash`  | GLM-4-Flash         | Smart path planning, routing, reasoning        |
| `glm_vision` | GLM-4V-Flash        | Action path screenshot / image analysis        |
| `notebooklm` | NotebookLM API      | Layer-3 grounded long-term memory recall       |
| `qwen_local` | Qwen (Ollama)       | Terminal + browser execution via Neural Router |
| `qwen_3d`    | Qwen3-3D (Ollama)   | 3D scene spec generation                       |
| `qwen_math`  | Qwen3-Math (Ollama) | Geometry / spatial math solving                |

---

## Three-Layer Memory

`memory-agent-mcp` implements hierarchical memory recall:

```
Layer 1 — Session (in-memory Map)
  → instant (0ms), covers current conversation
  → tool: append_session, recall_context (session_id required)

Layer 2 — InsForge cache (Postgres, last 7 days)
  → ~8ms query, covers recent missions
  → auto-populated by store_episode / write_task_result in insforge-agent-mcp

Layer 3 — NotebookLM deep recall (canonical grounded knowledge)
  → 15-20ms, covers all historical episodes
  → used ONLY when L1 + L2 both miss
```

The `recall_context` tool automatically cascades through layers and returns a `layer` field
indicating which layer served the response (`session | insforge | notebooklm | empty`).

---

## Intent Class → Agent Map

| Routing Path | Intent Class       | Primary Agent               | Model Lane | Verify? |
| ------------ | ------------------ | --------------------------- | ---------- | ------- |
| Smart        | `plan_task`        | planner-agent-mcp           | glm_flash  | No      |
| Smart        | `plan_task`        | scheduling-agent-mcp        | glm_flash  | No      |
| Smart        | `orchestrate`      | planner-agent-mcp           | glm_flash  | No      |
| Smart        | `design_ui`        | stitch-agent-mcp            | gemini     | No      |
| Smart        | `generate_3d`      | spline-agent-mcp            | qwen_3d    | No      |
| Smart        | `test_system`      | testsprite-agent-mcp        | qwen_local | No      |
| Action       | `recall_memory`    | memory-agent-mcp            | notebooklm | No      |
| Action       | `write_memory`     | memory-agent-mcp            | notebooklm | No      |
| Action       | `analyze_visual`   | vision-agent-mcp            | glm_vision | No      |
| Action       | `execute_terminal` | desktop-commander-agent-mcp | qwen_local | **Yes** |
| Action       | `automate_browser` | playwright-agent-mcp        | qwen_local | **Yes** |
| Fast         | `speak_voice`      | voice-agent-mcp             | gemini     | No      |
| Fast         | `translate`        | voice-agent-mcp             | gemini     | No      |
| Fast         | `converse`         | backend/ai.ts               | gemini     | No      |
| Backbone     | `validate_agent`   | validation-agent-mcp        | glm_flash  | —       |
| Backbone     | `health_check`     | health-agent-mcp            | none       | —       |
| Backbone     | `doc_lookup`       | docs-rag-agent-mcp          | notebooklm | —       |
| Backbone     | `registry_lookup`  | agent-registry-mcp          | none       | —       |

---

## Multilingual Capability

`voice-agent-mcp` v2.0 supports **17 languages** via `translate_and_speak`:

```
en, es, fr, de, pt, it, ja, ko, zh, ar, hi, ru, nl, pl, tr, sv, en-gb
```

Flow: `translate_and_speak { text, target_language }` → Gemini translates → matching Edge-TTS voice synthesizes.
Use `list_supported_languages` to get the full voice map.

---

## Agent Startup Commands

All agents are started from inside their own directory.

### PlannerAgent

```bash
cd mcps/agents/planner-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio** — launched by MCP host on demand
- No persistent port required

### MemoryAgent

```bash
cd mcps/agents/memory-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `NOTEBOOKLM_API_KEY`, `INSFORGE_API_BASE_URL`, `INSFORGE_TOKEN`
- **3-layer recall**: Layer 1 (session in-memory Map) → Layer 2 (InsForge Postgres 7-day cache) → Layer 3 (NotebookLM deep grounded recall)
- New tool `append_session { session_id, role, content }` writes to Layer 1
- `recall_context` response includes a `layer` field: `session | insforge | notebooklm | empty`

### VisionAgent

```bash
cd mcps/agents/vision-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `ZAI_API_KEY` (GLM-4.6V-Flash), optional `OLLAMA_HOST` (fallback Qwen3-VL-2B)

### DesktopCommanderAgent

```bash
cd mcps/agents/desktop-commander-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `AUDIT_LOG_PATH` (default: `backend/logs/desktop-commander-audit.jsonl`)
- ⚠ Runs with host OS permissions — enforce `allowed_roots`

### PlaywrightAgent

```bash
cd mcps/agents/playwright-agent-mcp
npm run install:browsers   # one-time
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `PLAYWRIGHT_BROWSER` (default: chromium)
- ⚠ SSRF guard blocks file:// and private IPs — do not disable

### InsForgeAgent

```bash
cd mcps/agents/insforge-agent-mcp
npm run build && node dist/index.js
```

- Transport: **SSE** (server-sent events, served via Vercel)
- Env: `INSFORGE_BASE_URL`, `INSFORGE_API_KEY`
- Local fallback: `data/insforge_cache.jsonl`

### StitchAgent

```bash
cd mcps/agents/stitch-agent-mcp
npm run build && node dist/index.js
```

- Transport: **SSE**
- Env: `GEMINI_API_KEY`, optional `STITCH_BASE_URL`

### TestSpriteAgent

```bash
cd mcps/agents/testsprite-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `PROJECT_ROOT` (default: workspace root)
- Requires: `vitest` and `playwright` installed in project

### SplineAgent

```bash
cd mcps/agents/spline-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `OLLAMA_HOST` (default: http://127.0.0.1:11434), `ZAI_API_KEY` (fallback)
- Requires: Ollama running with `qwen3-3d:1.8b` and `qwen3-math:4b` pulled

### SchedulingAgent

```bash
cd mcps/agents/scheduling-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `INSFORGE_API_BASE_URL`, `INSFORGE_TOKEN`
- Routing path: **Smart** (GLM-4-Flash)
- Triggers: event / calendar / reminder / appointment / meeting / deadline / schedule / alarm
- Tools: `create_event`, `list_events`, `update_event`, `delete_event`, `get_next_event`
- Backed by InsForge Postgres table `agent_events`. Create the table once:

```sql
CREATE TABLE IF NOT EXISTS agent_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ,
  recurrence TEXT DEFAULT 'none',
  tags       TEXT[] DEFAULT '{}',
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Run this SQL via InsForge dashboard or `mcp_io_github_ins_run-raw-sql` before first use.

### VoiceAgent

```bash
cd mcps/agents/voice-agent-mcp
npm run build && node dist/index.js
```

- Transport: **SSE** (phone/remote)
- Env: `GEMINI_API_KEY`, `EDGE_TTS_VOICE` (default: en-US-GuyNeural)
- Requires: `edge-tts` Python package (`pip install edge-tts`)
- **v2.0 — Multilingual**: 17 languages supported via `translate_and_speak { text, target_language }`
- Flow: Gemini 1.5 Flash translates text → matching Edge-TTS neural voice synthesizes audio
- Languages: `en es fr de pt it ja ko zh ar hi ru nl pl tr sv en-gb`
- Use `list_supported_languages` to retrieve full language → voice-id map

---

## Validation Layer — New Backbone Agents

The following four agents form the **universal validation layer**. They must be started before any acceptance test run. No agent is considered `active` until it has passed all 5 validation levels.

### ValidationAgent

```bash
cd mcps/agents/validation-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `REGISTRY_PATH` (default: `mcps/agent-registry.json`), `ZAI_API_KEY`
- **Role**: Orchestrates 5-level acceptance tests for every MCP agent.
- **Level weights**: L1=10 pts · L2=20 pts · L3=35 pts · L4=25 pts · L5=10 pts
- **Readiness rules**:
  - `quarantined` — L1 crashed
  - `failed` — L2 or higher failed
  - `degraded` — L1+L2 pass but L3/L4 partial
  - `active` — all 5 levels passed
- Cache: validation results append to `data/validation_cache.jsonl` (fallback if registry write fails)

### HealthAgent

```bash
cd mcps/agents/health-agent-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `ZAI_API_KEY` (for GLM lane check), `INSFORGE_BASE_URL`, `OLLAMA_HOST`
- **Role**: Pings all services, model lanes, DB, and Cerebral VM.
- **Tools**: `ping_service`, `check_model_lane`, `check_db_connection`, `check_cerebral_vm`, `sweep_all_services`
- Run `sweep_all_services` before any validate run to pre-screen degraded lanes.

### DocsRAGAgent

```bash
cd mcps/agents/docs-rag-agent-mcp
npm run build && node dist/index.js
```

- Transport: **SSE** (Vercel)
- Env: `GEMINI_API_KEY`, `DOCS_ROOT` (default: workspace root), `DOCS_INDEX_PATH`
- **Role**: Full-text retrieval from local `mcps/` docs. NotebookLM primary, local keyword search fallback.
- Run `index_local_docs` once after any schema or manifest change.

### AgentRegistryMCP

```bash
cd mcps/agents/agent-registry-mcp
npm run build && node dist/index.js
```

- Transport: **stdio**
- Env: `REGISTRY_PATH` (default: `mcps/agent-registry.json`)
- **Role**: Live read/write interface to `agent-registry.json`.
- **Tools**: `list_agents`, `get_agent_capabilities`, `update_agent_status`, `get_fallback_chain`, `check_authority`, `get_system_readiness`
- `update_agent_status` validates the status enum server-side — prevents arbitrary field injection.

---

## Validation Workflow

Run this sequence on first boot or after any agent change:

```bash
# 1. Start backbone services
node mcps/agents/health-agent-mcp/dist/index.js       # validate infra first
node mcps/agents/agent-registry-mcp/dist/index.js     # registry must be live
node mcps/agents/validation-agent-mcp/dist/index.js   # orchestrator ready

# 2. Run health sweep (catches dead model lanes before they fail L2)
# Call: health-agent-mcp:sweep_all_services → inspect degraded_count

# 3. Run full system validation
# Call: validation-agent-mcp:run_system_validation { filter_status: "unknown" }
# This runs L1→L5 for all 14 agents sequentially.

# 4. Check readiness
# Call: agent-registry-mcp:get_system_readiness → readiness_pct should be >= 80%
```

### Tests Directory

```
mcps/tests/
  validation/
    validation-matrix.json    ← 14-agent × 5-level tracking table (updated by ValidationAgent)
  agent-tests/
    planner.test.json         ← per-agent basic + complex test specs
    memory.test.json
  system-tests/
    e2e-smoke.json            ← 4-test end-to-end pipeline smoke check
```

---

## Full Stack Startup (Development)

Start backend first, then agents on demand:

```bash
# 1. Backend Express + WS server
cd backend && npm run build && npm run start

# 2. Python Neural Router
python server.py  # port 6004

# 3. MCP agents (each in its own terminal, stdio auto-launched by host)
#    OR use PM2 ecosystem for production (see ecosystem.config.cjs)
```

### PM2 Production (Cerebral)

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Add entries to `ecosystem.config.cjs` for each agent:

```js
{
  name: 'planner-agent',
  script: 'mcps/agents/planner-agent-mcp/dist/index.js',
  interpreter: 'node',
}
```

---

## Environment Variables Reference

Create `mcps/.env` or add to root `.env.local`:

```env
# Model Keys
ZAI_API_KEY=              # GLM-4-Flash, GLM-4.6V-Flash (Z.ai/Zhipu)
GEMINI_API_KEY=           # Gemini 1.5 Flash/Pro
NOTEBOOKLM_API_KEY=       # NotebookLM query API (Google)
NOTEBOOKLM_NOTEBOOK_ID=   # Notebook to query for memory

# Deployment
INSFORGE_BASE_URL=        # InsForge API base (Vercel)
INSFORGE_API_KEY=         # InsForge auth token
MEMORY_BASE_URL=          # MemoryAgent Vercel endpoint
CANONICAL_MEMORY_BASE_URL=# Optional canonical lake URL

# Local
OLLAMA_HOST=http://127.0.0.1:11434
AUDIT_LOG_PATH=backend/logs/desktop-commander-audit.jsonl
EDGE_TTS_VOICE=en-US-GuyNeural

# Neural Router
NEURAL_ROUTER_URL=http://127.0.0.1:6004
```

---

## Health Check

Hit the backend health endpoint to see which model lanes and intent routes are active:

```bash
curl http://localhost:6001/api/health | jq .
```

Expected response includes:

```json
{
  "services": {
    "intent_router": "active (18 intent classes → 14 MCP agents)",
    "model_lanes": [
      "glm_flash",
      "gemini",
      "notebooklm",
      "qwen_local",
      "glm_vision",
      "qwen_3d"
    ]
  }
}
```

Agent registry status is at `mcps/agent-registry.json` — status fields are updated at runtime by the kernel.

---

## Security Notes

1. **DesktopCommanderAgent** — all `run_terminal`, `write_file`, `kill_process` calls audited to `backend/logs/desktop-commander-audit.jsonl`
2. **PlaywrightAgent** — `assertSafeUrl()` blocks `file://`, `localhost`, `127.x`, `10.x`, `192.168.x`, `172.16-31.x`
3. **InsForgeAgent** — only writes to `agentlee_*` prefixed tables; no DELETE without approval
4. **VisionAgent** — rejects images > 10 MB before any API call
5. **All agents** — use `envRequired()` from `agents/shared/env.ts` for mandatory keys; fail fast on startup if missing
