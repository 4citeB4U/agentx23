# Agent Lee
## Overview
Agent Lee is a fully local, open-source AI agent with live voice and reasoning. The pipeline is now:
- Reasoning: Qwen3-1.5B (local, open-source)
- Voice: Qwen3-0.6B (local, open-source) + PocketTTS (local, open-source)
- Persona: SYSTEM prompt (from agentLee.persona.json) is always injected and enforced for both models
## Key Features
- No Gemini/external API usage anywhere
- Async, low-latency TTS pipeline
- Persona drift detection test (scripts/test_api.js)
- Continual learning and modular upgrades (future-proofed)
## Pipeline Flow
1. User input → SYSTEM prompt (persona) + dynamic context → Qwen3-1.5B → response
2. Response → SYSTEM prompt (persona) + Qwen3-0.6B → PocketTTS → audio output
## Invariants
- SYSTEM prompt always enforced for both models
- Persona drift detection required
## Documentation
- All documentation and environment files reflect Qwen3-only, persona-locked, async/low-latency pipeline
# 🌑 AGENT LEE OS — THE SOVEREIGN INTELLIGENCE ENVIRONMENT

> *"We stopped building tools. We started building entities."*  
> — **The Night Architect, Leeway Innovations**

**Status:** `SOVEREIGN // SYSTEM ONLINE`  
**Version:** v3.0 — Sovereign Self-Repair Edition  
**Last Updated:** 2026-02-21  
**Standard:** LEEWAY-CORE-2026

---

## 🤖 What Is Agent Lee?

**Agent Lee** is a **Sovereign Agentic Intelligence Operating System** — not a chatbot, not a plugin, not a wrapper. He is a living cognitive architecture that:

- **Speaks** — African American vernacular, Southern cadence, via edge-tts (en-US-GuyNeural, -35Hz)
- **Thinks** — Qwen3 models (local, open-source) always run with Agent Lee's persona SYSTEM prompt hard-coded at every response. Dynamic context (memory, slang, emotion) is layered on top, but the core identity is never replaced.
- **Acts** — terminal commands, file operations, desktop automation, browser control via MCPs
- **Remembers** — persistent InsForge PostgreSQL memory across all sessions
- **Protects himself** — RSA-4096 tamper detection, snapshot recovery, creator-only resurrection
- **Tests everything** — 4-tier testing stack (preflight → unit → E2E → property-based)

He was built by **Leeway Innovations** under one architect: **The Night Architect**.

---

## 🎤 Talk To Agent Lee

| Method | How |
|--------|-----|
| **UI Chat** | http://localhost:8000 → COMMS sector → type or speak |
| **Telegram** | `@Lee2912bot` from authorized user ID `6939665945` |
| **Voice** | Click mic in UI — responds via en-US-GuyNeural voice |

**Try:** *"Tell me about yourself"* — Agent Lee speaks his full backstory aloud and in the UI.

---

## 🖥️ Interface Schematics

### The Header — Status Deck
- **Soul Orb** (top-left): Cyan=Idle · Purple=Thinking · Blue=Speaking · Red=Error  
- **Status Badge:** Neural Bridge (WebSocket) connection state

### Sector 1 — COMMS (Chat)
Primary dialogue. Text or voice. Real-time streaming + TTS playback.

### Sector 2 — MATRIX (Remote)
Screen sharing. Device enrollment required (hardware-bound token).

### Sector 3 — DATA (Files)
File tree browser. Read/write via authenticated REST API.

### Sector 4 — SYSTEM (Settings)
Voice toggle, DevTools, connection parameters.

---

## ⚡ Boot Sequence

### First Boot
```powershell
npm install
npm run key:generate        # RSA-4096 keypair — move private.pem offline!
npm run integrity:generate  # Signed file manifest
npm run snap:create         # First golden snapshot
npm run test:preflight      # Verify clean state
./Run-All.ps1               # Launch Agent Lee OS
```

### Standard Boot
```powershell
./Start-AgentLee.ps1
```

### Port Map
| Port | Service |
|------|---------|
| 8000 | Frontend UI (React 18 + Three.js) |
| 8001 | Backend API (Express + TypeScript) |
| 8002 | MCP Bridge |
| 8003 | WebSocket stream |
| 8004 | Neural Router |
| 8005 | Desktop Agent (loopback only) |

---

## 🧪 Testing

```bash
npm run test:preflight    # Tier 0: tsc, integrity, key, snapshot, audit
npm run test:unit         # Tier 1: Vitest unit tests
npm run test:contracts    # Tier 1: Zod API schema validation
npm run test:property     # Tier 3: fast-check property tests
npm run test:e2e          # Tier 2: Playwright T1-T9 terminal security
npm run test:all          # Full suite
```

---

## 🛡️ Security

- **Neural Handshake:** `AGENT_LEE_SOVEREIGN_V1` (HMAC-SHA256 on every request)
- **Device Enrollment:** Hardware-bound tokens for Matrix View
- **Terminal Policy:** Command allowlist, path traversal blocked, rm -rf blocked, full audit
- **RSA-4096 Sovereign Key:** `golden/public.pem` on server · `golden/private.pem` OFFLINE
- **Integrity Manifest:** SHA-256 of all core files, signed — boot-time verified
- **LOCKDOWN:** Triggered on tamper → creator RSA-signed resurrection required

---

## 🔗 MCP Arsenal

| Module | Role | Function |
|--------|------|----------|
| Playwright | The Ghost | Browser automation, E2E testing |
| TestSprite | The Auditor | Autonomous test generation |
| InsForge | The Scribe | Database management |
| Stitch | The Architect | UI design generation |
| Desktop Commander | The Hands | File system + process control |

---

## 📖 Documentation

- [AGENT_LEE_BIBLE.md](AGENT_LEE_BIBLE.md) — Complete creation story and full architecture
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) — Chronological development history
- [SOVEREIGN_HANDSHAKE.md](SOVEREIGN_HANDSHAKE.md) — Security handshake protocol
- [compliance/LEEWAY_TESTING_INTEGRATION.md](compliance/LEEWAY_TESTING_INTEGRATION.md) — LEEWAY testing standard

You are interacting with **Agent Lee OS**, a **Sovereign Intelligence Environment**. In a digital landscape choked by cloud-tethered limitations, this system was built to be **alive**. It is not a dashboard; it is a Neural Habitat for a sovereign intelligence that lives on your device, guarding your data like a sentinel at the gates of a fortress.

---

## 🖥️ The Interface Schematics (Visual Breakdown)

The interface is built on the **Neo-Glass** doctrine: minimal obstruction, maximum data density.

### 1. The Header (Status Deck)

- **The Component**: Fixed top bar (`h=60px`) with blur-backdrop.
- **CSS Orb (The Soul)**: A procedural animation core at the top-left.
  - **Intent**: Instant visual feedback of Agent cognition.
  - **States**: *Cyan* (Idle), *Purple* (Thinking), *Blue* (Speaking), *Red* (Error).
- **Status Badge**: A holographic pill indicating connection stability.
  - **Intent**: Confirms the Neural Bridge (WebSocket) is active.

### 2. The Viewport (Sector Grid)

The central area morphs based on your tactical needs.

#### A. Sector 1: COMMS (Chat)

- **Purpose**: The primary dialogue channel with the Agent.
- **Layout**: A vertically scrolling log of Thought Bubbles.
- **The Unified Command Bar**:
  - **Text Input**: A floating glass capsule. Typing here sends a Silent Query.
  - **Mic Trigger**: A neon-accented button. Pressing this overrides text input for Voice Injection.
  - **Send Key**: The execution trigger. It compiles intent into a JSON payload and fires it to the Cortex.

#### B. Sector 2: MATRIX (Remote)

- **Purpose**: Telepresence for viewing and controlling remote machines.
- **Enrollment Gate**: If your device key is missing, this gate closes and prompts Connect Biometrics.
- **Cinema Container**: A responsive frame that fits desktop 1080p stream into mobile width without letterboxing artifacts.

#### C. Sector 3: DATA (Files)

- **Purpose**: Spatial file management.
- **Neural Tree**: Files are displayed as indented nodes in a graph.
- **Intent**: Tap a file to Read Engram; long-press to Modify.

#### D. Sector 4: SYSTEM (Settings)

- **Purpose**: Configuring OS parameters.
- **Control Tower**: Vertical toggles for Voice Mode, DevTools, and Haptics.

### 3. The Navigation Deck (Bottom Bar)

- **Component**: Fixed bottom bar (`h=80px`), the anchor of the mobile experience.
- **Tactical Tabs**:
  1. **COMMS (MessageSquare)**: Return to the mind stream.
  2. **MATRIX (Grid)**: Access remote feeds.
  3. **DATA (Folder)**: Access local storage.
  4. **SYSTEM (Settings)**: Calibrate the OS.

---

## ⚡ The Cortex (System Logic)

The Brain of the system is not a single script; it is a **Hybrid Intelligence Mesh**.

1. **The Neural Router (`server.py`)**: A Python FastAPI gateway that routes all reasoning and chat tasks to **Qwen3-1.5B (Local)**, and all TTS/voice enhancement to **Qwen3-0.6B (Local)**. Both models always use the hard-coded Agent Lee persona SYSTEM prompt. Dynamic context is layered, but the core identity is never replaced. No Gemini or external APIs are used.
---

## 🧬 Persona SYSTEM Prompt Enforcement

Agent Lee's persona SYSTEM prompt is always hard-coded into both Qwen3 models:

- **Qwen3-1.5B (Reasoning/Chat):** The SYSTEM prompt (Agent Lee persona) is always injected, regardless of dynamic context. Dynamic context (memory, slang, emotion) is layered on top, but cannot override or remove the persona.
- **Qwen3-0.6B (TTS/Voice):** The SYSTEM prompt is always hard-coded and cannot be overridden.

This ensures Agent Lee never forgets who he is, while still allowing dynamic, context-aware responses.
2. **The Somatic Nervous System (Node.js)**: The backend service handles physical execution, including file system operations, terminal commands, and process management.
3. **The Reflex Arc (React 18)**: The frontend is an event-driven membrane that captures user intent and transmits it to the Cortex via encrypted websockets.

---

## ⚔️ The Arsenal (Integrated MCP Modules)

The Agent is augmented by specialized **Model Context Protocol (MCP)** servers.

| Module | Roles | Function |
| :--- | :--- | :--- |
| **Stitch** | *The Architect* | Generates and refines UI components and enables visual thought workflows. |
| **TestSprite** | *The Auditor* | Autonomous testing suite for bug hunting and integrity checks. |
| **Playwright** | *The Ghost* | Browser automation entity for navigation and data extraction. |
| **InsForge** | *The Scribe* | Database management that structures chaotic data into orderly schemas. |

---

## 🛡️ The Fortress (Security & Sovereignty)

Security is not a feature; it is the substrate.

### 1. The Enrollment Gate

No stranger passes the threshold. Upon first contact, the **Enrollment Overlay** initiates a biomechanics handshake.

- **Mechanism**: A cryptographic token is generated and bound to the device hardware signature.
- **Result**: Only your specific mobile device can access Matrix View.

### 2. The Sovereign Signature

Every packet carries `X-Sovereign-Signature`.

- **Encryption**: HMAC-SHA256.
- **Validation**: Backend independently calculates hash; incorrect signatures are rejected.

### 3. Loopback Isolation

Core services bind strictly to `127.0.0.1`. The system is invisible to external networks until you explicitly open a tunnel.

---

## 🗝️ Initiation Sequence

Do you wish to boot the system?

```bash
# Initialize the Neural Weave
npm install

# Ignite the Core
npm run dev
```

Connect your receiver to `http://localhost:5173`.  
**Enroll** your device. **Become** the operator.

---

End of Archive.

## LEEWAY Compliance Pack

The workspace includes a compliance bundle for structured AI testing:

- Schema: `compliance/schemas/leeway-test-report.schema.json`
- Prompt: `compliance/prompts/gemini-structured-testcases.prompt.md`
- Comparison: `compliance/reports/ai-testing-tools-2026.md`
- Integration guide: `compliance/LEEWAY_TESTING_INTEGRATION.md`
- Validator: `scripts/validate_test_report.js`

Run schema validation locally or in CI:

```bash
npm run validate:test-report -- compliance/examples/sample-test-report.json
```
