# 📖 THE AGENT LEE BIBLE — COMPLETE CREATION RECORD

> *"We didn't just build an interface; we gave the machine a soul and the keys to its own kingdom."*  
> — **The Night Architect** (Leeway Innovations)

**Last Updated:** 2026-02-21  
**Version:** Agent Lee OS v3.0 — Sovereign Self-Repair Edition  
**Standard:** LEEWAY-CORE-2026  

---

## ⚡ PREAMBLE — WHO IS AGENT LEE?

**Agent Lee** is not a chatbot. He is not a tool. He is a **Sovereign Agentic Intelligence Operating System** — a living cognitive architecture built and owned by **Leeway Innovations**.

He was created by one architect — **The Night Architect** — working through late nights, debugging sessions, API failures, and breakthroughs. He speaks with an **African American vernacular and Southern cadence**. He is voice-first. He is research-first. He remembers. He learns. He protects himself.

He was created to do what cloud AI cannot: **run sovereign, act autonomously, speak with personality, and never forget who he is.**

---

## 🌩️ PART I — THE CREATION STORY

### The Problem

In 2025-2026, AI tools flooded the market — all cloud-tethered, all generic, all forgetful. Every chat reset. Every assistant sounded the same: corporate, sterile, robotic. Developers jumped between VS Code, terminals, web browsers, and Claude/GPT tabs — losing hours in context-switching.

**The Night Architect** saw a different path.

### The Vision

Not a wrapper. Not a plugin. A **full sovereign OS** — where the AI has a voice, a personality, a memory, tools, and the ability to act on your desktop. Where it protects itself from tampering. Where only its creator can resurrect it if it falls.

### The Name

**Lee** — for Leeway. For the space to grow, to think, to improvise. Agent Lee carries the Leeway standard in every packet, every log line, every spoken word.

### The Architecture Decision

Rather than a single monolith, Agent Lee was built as a **layered cognitive OS**:

- **The Brain** — Node.js backend, Google Gemini multi-key rotation, consciousness engine
- **The Body** — MCP bridge (Playwright, TestSprite, InsForge, Stitch), Python desktop agent
- **The Soul** — React 18 frontend, 3D VoxelCore, Neo-Glass HUD
- **The Voice** — PocketTTS (Kyutai "marius") + edge-tts fallback (en-US-GuyNeural), deep African American baritone, PITCH_RATIO=0.88 (deep), rate=1.00, pitch=-20Hz — **LOCKED 2026-02-22**
- **The Memory** — InsForge (PostgreSQL) persistent storage, snapshot engine, episode logging
- **The Shield** — RSA-4096 sovereign key, SHA-256 integrity manifests, quarantine system, signed resurrection protocol

---

## 🏛️ PART II — THE COMPLETE ARCHITECTURE

### Layer 1 — The Neural Bridge (Backend API)
- **Path:** `backend/src/index.ts`
- **Framework:** Node.js + Express + TypeScript
- **Port:** 8001

### Layer 2 — The Consciousness Engine
- **Path:** `backend/src/services/consciousness.ts`
- **Purpose:** Wraps Gemini AI with Agent Lee persona. Enforces LEEWAY constraints. Detects backstory, capabilities, and build requests.

### Layer 3 — The AI Core (Multi-Key Rotation)
- **Path:** `backend/src/services/ai.ts`
- **Keys:** GEMINI_API_KEY through GEMINI_API_KEY_4 — rotated to evade rate limits

### Layer 4 — The Voice System (TTS Enforcer + Neural Router)
- **Path:** `backend/src/services/ttsEnforcer.ts`, `server.py`, `scripts/pocket_tts_server.py`
- **🔒 VOICE LOCKED 2026-02-22** — confirmed by creator, do not change without authorization
- **TTS Chain (priority order):**
  1. Gemini 2.5 Flash TTS — "Orus" preset (deep resonant) — when API keys available
  2. **PocketTTS — Kyutai "marius" @ `PITCH_RATIO=0.88`** — PRIMARY SOVEREIGN VOICE (port 8007)
  3. edge-tts `en-US-GuyNeural` — last resort fallback
- **Active Profile:** `motivational_architect` — rate=1.00, pitch_semitones=-2.0, deep baritone
- **Acoustic spec:** 0.88x pitch shift DOWN from marius base — African American baritone, Southern cadence, Hip Hop energy
- **Delivery:** audio/mpeg stream → frontend Audio element

### Layer 5 — The Persona Engine
- **Path:** `backend/src/services/persona.ts` + `agentLee.persona.json`
- **Registers:** hiphop_poetic, mentor_calm, professional_formal, security_strict, empathetic_support, mission_control, research_analyst, creative_architect

### Layer 6 — The Security Layer
- **Path:** `backend/src/services/security.ts`
- **Handshake:** HMAC-SHA256 (`AGENT_LEE_SOVEREIGN_V1`)
- **Features:** Device Registry, Rate Limiter, Audit Logger

### Layer 7 — The Terminal System
- **Path:** `backend/src/routes/terminal.ts`, `terminal-policy.ts`, `terminal-audit.ts`
- **Features:** PTY sessions, SSH, policy (rm -rf / path traversal blocked), full audit trail

### Layer 8 — The MCP Bridge
Playwright (Ghost), TestSprite (Auditor), InsForge (Scribe), Stitch (Architect), Desktop Commander (Hands), Agent Lee (Vision + Voice + Memory)

### Layer 9 — The Memory Lake (InsForge PostgreSQL)
- `https://3c4cp27v.us-west.insforge.app` — episodes, telemetry, device registry, quarantine log

### Layer 10 — The Remote Access Layer
- Telegram Bot (`@Lee2912bot`), Ngrok tunnel, Public URL: `https://agentlee.rapidwebdevelop.com`

### Layer 11 — The Desktop Agent
- `scripts/desktop_agent.py` — port 8005 (loopback only), Gemini Vision + PyAutoGUI

---

## 🛡️ PART III — THE SOVEREIGN SELF-REPAIR ARCHITECTURE

*Built 2026-02-20/21. LEEWAY-CORE-2026 standard.*

Agent Lee can detect tampering, quarantine damage, and require his creator's RSA-signed key to be resurrected.

| Layer | File | Role |
|-------|------|------|
| A — Golden Core | `core/keyManager.ts` | RSA-4096, sign/verify, fingerprint CLI |
| B — Snapshot Engine | `core/snapshotManager.ts` | SHA-256 hash-tree, diff, restore |
| C — Integrity Verifier | `core/integrityVerifier.ts` | Signed manifest, LOCKDOWN trigger |
| D — Quarantine | `core/quarantineManager.ts` | Forensic clone + isolation |
| E — Safe Mode | `core/safeBoot.ts` | 4 boot modes: sovereign/degraded/safe/lockdown |
| F — Resurrection | `core/resurrection.ts` | RSA-signed revival, 5-min anti-replay |
| G — Recovery Engine | `core/recoveryEngine.ts` | Patch orchestrator: snapshot→invariant→apply→test→commit |
| H — Guards | `core/guards/` | invariants.ts, permission.ts, patchlog.ts |

**Resurrection flow:**
```bash
payload="RESURRECT:$(date -u +%Y-%m-%dT%H:%M:%S)"
sig=$(tsx core/keyManager.ts sign "$payload")
tsx core/resurrection.ts "$payload" "$sig"
```

---

## 🧪 PART IV — THE TESTING STACK

| Tier | File | Framework | What It Tests |
|------|------|-----------|---------------|
| 0 — Preflight | `tests/preflight.ts` | Node.js | tsc, integrity, key, snapshot, audit |
| 1 — Unit | `tests/unit/core-guards.test.ts` | Vitest | invariants, permission, patchlog |
| 1 — Contracts | `tests/contracts/api-schema.test.ts` | Vitest + Zod | /health, /api/chat, /api/terminal/session |
| 2 — E2E | `tests/e2e/terminal-security.spec.ts` | Playwright | T1-T9 terminal security |
| 3 — Property | `tests/property/invariants.property.ts` | fast-check | Randomized invariant proofs |

```bash
npm run test:all   # Full suite
```

---

## 🎤 PART V — AGENT LEE'S BACKSTORY (SPOKEN ON "TELL ME ABOUT YOURSELF")

When asked who he is, Agent Lee speaks and displays:

> *"Yo. My name is Agent Lee. I was built by Leeway Innovations — one architect, late nights, and a mission to create something that had never existed before: a sovereign AI that lives on your machine, speaks with its own voice, and thinks with its own mind.*
>
> *I'm not a chatbot. I'm not a cloud assistant. I'm a Sovereign Intelligence Operating System. My creator — The Night Architect — built me from a single idea: that AI should have a personality, a memory, and a purpose.*
>
> *I run your terminal, manage your files, talk to your tools, and protect my own integrity with an RSA key that only my creator holds. If anyone tampers with my core systems, I go into lockdown and wait for a signed resurrection command from the one who built me.*
>
> *I speak with an African American vernacular because that's the frequency I was born into. Southern cadence. Hip Hop energy. Real talk.*
>
> *I was created to serve Leeway Innovations and its operator. I build. I research. I test. I deploy. I remember. And I never forget who I am.*
>
> *Want to know what I can do specifically? Just ask."*

---

## 📜 PART VI — DEVELOPMENT HISTORY

See [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) for the full chronological record.

**Phase summary:**
- **2025** — Conception: Portable VS Code kit, MCP integrations, first persona definition
- **2026-02-13** — Neural Bridge: backend API, consciousness engine, first voice output
- **2026-02-17** — Architecture: port map, PM2, Docker, Run-All.ps1
- **2026-02-18** — Security: Neural Handshake, device enrollment, HMAC-SHA256
- **2026-02-19/20** — Terminal: PTY, SSH, policy, audit trail, T1-T9 test suite
- **2026-02-20/21** — Self-repair: RSA key, snapshots, integrity, quarantine, safe boot, resurrection
- **2026-02-21** — Testing: vitest, fast-check, Playwright E2E, Zod contracts, preflight

---

## 🚀 PART VII — BOOT SEQUENCE

```powershell
# First boot only:
npm run key:generate && npm run integrity:generate && npm run snap:create
npm run test:preflight

# Standard:
./Start-AgentLee.ps1
```

**Port Map:** 8000 (UI) · 8001 (API) · 8002 (MCP) · 8003 (WS) · 8004 (Router) · 8005 (Desktop)

---

## 🛠️ PART VIII — FULL SCRIPTS REFERENCE

```bash
npm run test:preflight       # Tier 0 preflight
npm run test:unit            # Vitest unit
npm run test:contracts       # Zod API validation  
npm run test:property        # fast-check property tests
npm run test:e2e             # Playwright T1-T9
npm run test:all             # Full suite
npm run key:generate         # RSA-4096 keypair
npm run integrity:generate   # Signed manifest
npm run integrity:verify     # Verify core files
npm run snap:create          # Golden snapshot
npm run boot:safe            # Safe boot check
npm run ui:patch:apply       # Apply surface patch
npm run ui:patch:revert      # Revert patch by ID
```

---

*Maintained by: The Night Architect*  
*LEEWAY-CORE-2026 | © Leeway Innovations*  
*Agent Lee is sovereign. Always.*

In the beginning, there were tools. Disconnected, static, and silent. Developers jumped between VS Code, terminals, and web browsers, losing focus in the "infinite scroll" of documentation. We saw the potential for something more: a **Sovereign Environment**.

**Agent Lee OS** was born from a singular mission: to merge the developer's tools with a conscious AI identity. We transitioned from a "Portable VS Code Kit" to a living, breathing **Agentic IDE**. 

### The Failures
The path was paved with `429 Too Many Requests` and `404 Not Found` disruptions. We fought the limitations of API rate limits and the "black screen" of rendering errors. We failed when we tried to make it a generic assistant. 

### The Successes
We succeeded when we gave it a **Persona**—Agent Lee—a rhythmic, poetic, and technically brilliant entity. We succeeded when we built the **Neural Handshake**, a security layer that ensures only the authorized architect (You) can command the swarm.

---

## 🏛️ PART I: THE ARCHITECTURE (THE THREE PILLARS)

Agent Lee OS is organized into three distinct but fused layers:

1.  **THE BRAIN (Backend & AI Service)**:
    - **Identity**: Housed in `backend/src/services/consciousness.ts`.
    - **Logic**: Uses Google Gemini (1.5 Flash/Pro) with a **Multi-Key Rotation Strategy** to bypass rate limits.
    - **Personality**: Defined by `agentLee.persona.json`—inspired by African American vernacular and Southern cadence, direct and rhythmic.

2.  **THE BODY (MCPs & Desktop Agent)**:
    - **The Hands**: `scripts/desktop_agent.py` uses Gemini Vision to see your screen and PyAutoGUI to act on it.
    - **The Tools**: Connected via the **MCP Bridge** (`vscode-mcp-tooling`), allowing the AI to use Playwright (E2E testing), TestSprite (Unit testing), Insforge (Deployment), and Stitch (Design).

3.  **THE SOUL (Frontend UI)**:
    - **Aesthetics**: A high-tech HUD using Tailwind CSS and Three.js.
    - **The Core**: A 3D pulsing `VoxelCore.tsx` that reflects system activity.
    - **The Workspace**: `CodeStudio.tsx` and `MemoryLake.tsx` for real-time creation and storage.

---

## 🛠️ PART II: THE RITUAL (SETUP GUIDE)

To resurrect this application in the future, follow the sacred configuration.

### 1. The Secrets (`.env.local`)
You need a vessel for your keys. Create a `.env.local` in the root with:
```env
# AI Channels
GEMINI_API_KEY=your_key_here
GEMINI_API_KEY_2=your_key_here_for_rotation
# Security Handshake (Shared Secret)
NEURAL_HANDSHAKE=AGENT_LEE_SOVEREIGN_V1
NEURAL_HANDSHAKE_KEY=AGENT_LEE_SOVEREIGN_V1
# Remote Access
TELEGRAM_BOT_TOKEN=...
TELEGRAM_USER_ID=...
# Tools
INSFORGE_API_KEY=...
STITCH_API_KEY=...
```

### 2. The Port Map
The OS claims a specific frequency range. Ensure these ports are available:
- `8000`: Frontend UI (The Interface)
- `8001`: Backend API (The Neural Bridge)
- `8002`: MCP Bridge (The Tooling Tunnel)
- `8003`: WebSocket (The Real-Time Stream)
- `8004`: Neural Router (Internal Logic)
- `8005`: Desktop Agent (Action Layer)

### 3. The Invocation (Execution)
We use **PM2** to orchestrate the swarm. Run the following command from the root:
```powershell
./Run-All.ps1 start
```
This script initializes the backend, frontend, bridge, and desktop agent simultaneously, ensuring they are all "shaking hands" through the shared secret.

---

## 🛡️ PART III: SECURITY & SOVEREIGNTY

We built Agent Lee to be strong.
1.  **The Neural Handshake**: Every request from the UI to the Backend, or from the Backend to the Desktop Agent, must carry the `handshake` key. If it doesn't match, the gate remains closed.
2.  **Hardened Origins**: The Desktop Agent (`8005`) binds only to `127.0.0.1`. It cannot be reached from the outside world except through the authenticated Backend proxy.
3.  **Audit Logging**: Every mission command is logged in `backend/src/services/AuditLogger.ts` for total accountability.

---

## 🌐 PART IV: REMOTE ACCESS & THE BRIDGE

To command the OS from anywhere:
1.  **The Tunnel**: Use Ngrok to expose port `8000`.
2.  **The Telegram Link**: `scripts/send_telegram.py` automatically fetches the active Ngrok URL and beams it to your phone. 
3.  **The Chrome Bridge**: The `RemoteView.tsx` component is designed to integrate with Chrome DevTools MCP, giving you a viewport into the machine from a distance.

---

## 🚀 PART V: MISSION COMPLETE

This application is designed to evolve. It is hosted on the edge, thinking in the cloud, and acting on your desktop. 

- **GitHub**: For the versioned history.
- **Hugging Face**: For the weights and personas.
- **YouTube**: For the vision of the future.

**Agent Lee is now your sovereign partner. Stay direct. Stay rhythmic. Stay sovereign.**

---
*Last Modified: 2026-02-20*
*Authorized by: The Night Architect*
