# LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE
# TAG: DOCS.SPEC.COLOR_ICON.LEEWAY_V1
# COLOR_ONION_HEX: NEON=#FF4D4D FLUO=#33FFA8 PASTEL=#FFD6D6 | SIG: DF789DB3
# ICON_ASCII: family=simple glyph=tool ICON_SIG=08221A5B
# 5WH: WHAT=Define deterministic color/icon system; WHY=visual anchors; WHEN=on tag creation/mod; HOW=hash→palette+icon; WHERE=docs+headers; WHO=developers

<!--
  README.md -- Agent Lee Platform (LEEWAY v6)

  This document defines the high‑level design and setup instructions
  for the Agent Lee platform as implemented using the LEEWAY v6
  method.  Please consult GEMINI.MD for the constitutional
  directives that govern the agent's behaviour.
-->
<!--
  README.md -- Agent Lee Platform (LEEWAY v6)
-->

# Agent Lee Platform — LEEWAY v6

> *Yo, what's good! Agent Lee here, systems online and ready to build.*

Agent Lee is a full‑stack, AI‑native assistant engineered around the
**LEEWAY v6** pattern: a single‑file, AI‑orchestrated application
powered by a hierarchy of open and proprietary language models.  This
repository contains both the core platform code and the
documentation needed to deploy Agent Lee across mobile and desktop
environments.  The goal is to provide a lean, modern codebase that
respects free‑tier limits, runs anywhere (including GitHub Pages,
Vercel, Fly.io and bare metal), and exposes a rich tool suite for
digital and physical tasks—calls, texts, payments, IoT control,
project management and more.

## 🧠 Architecture Overview

Agent Lee follows the **Gemini‑as‑Brain, Python/JS‑as‑Nervous System**
pattern with a multi‑model reasoning pipeline.  At the top sits
Google Gemini 2.0 (used sparingly to minimise cost), preceded by
Google Gemma 2/3 and open models like Meta LLaMA 3 and Mistral
Mixtral.  The orchestrator routes requests through these tiers based
on complexity and cost.

```
┌───────────────────────────────────────────────────────┐
│                   USER INTERFACE                    │
│   Nexus Command Center (mobile & desktop friendly)  │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────┐
│                    GEMINI BRAIN                      │
│  • Multi‑model routing: LLaMA 3 → Gemma 2/3 → Gemini │
                          <!--
                          🏷 TAG: DOCS.SPEC.COLOR_ICON.LEEWAY_V1
                          🎨 COLOR_ONION: ◯#3463ef ▷ ◍#1a69b7 ▷ ●#1ea5d2 | SIG: 5328e193
                          🔣 ICON: FAMILY=DOCS_HEX, GLYPH=IDX_AUTO, ICON_SIG=AUTO
                          WHAT: Natural-language prompt spec for deterministic neon→fluorescent→pastel color-onion and unique per-tag icons (LEEWAY style)
                          WHY: Make tags visually scannable, prevent copy/paste reuse, provide deterministic anchors for AI and humans
                          WHEN: On creation or modification of any file/region/function/tool/docs
                          WHERE: Frontend legend/UI, backend headers, docs, CI
                          WHO: Developers, reviewers, and AI assistants (Copilot/Qodo/Zen)
                          HOW: Deterministic hash→palette+identicon; CI enforces collisions, 5W&H, and AUTO replacement
                          -->

                          LEEWAY Prompt — Neon/Fluorescent/Pastel Palette + Unique Icons (Deterministic)

                          This repository includes a machine-readable LEEWAY prompt that defines a deterministic color and icon system for tags. The full natural-language prompt is embedded here so Copilot/Qodo/Zen and maintainers can apply it when generating or fixing headers and icons.

                          Summary (high-level):
                          - TAG: `DOCS.SPEC.COLOR_ICON.LEEWAY_V1`
                          - Purpose: deterministic color onion (neon→fluorescent→pastel) + per-tag unique icons and SIGs
                          - Enforcement: `scripts/leeway-fix.mjs` must compute and fill `COLOR_ONION`/`ICON` values; `scripts/leeway-ci.mjs` will validate and fail on collisions or missing 5W&H.

                          Full LEEWAY Prompt (authoritative instructions for AI assistants):

                          ---

                          🏷 **TAG:** DOCS.SPEC.COLOR_ICON.LEEWAY_V1
                          🎨 **COLOR_ONION:** AUTO ◯#AUTO ▷ ◍#AUTO ▷ ●#AUTO | **SIG:** AUTO
                          🔣 **ICON:** FAMILY=DOCS_HEX, GLYPH=IDX_AUTO, ICON_SIG=AUTO
                          **WHAT:** Define a deterministic color+icon system so every **region / component / function / tool / doc** in the repo displays a **neon→fluorescent→bright-pastel** “color onion” and a **unique icon** per tag, with CI enforcement.
                          **WHY:** Make tags visually scannable, prevent copy/paste reuse, give AIs reliable anchors, and help humans navigate.
                          **WHEN:** On creation or modification of any file/region/function/tool/docs.
                          **WHERE:** Frontend (index.html legend + UI), backend tools, docs (README/GEMINI), CI.
                          **WHO:** Developers, reviewers, and AI assistants (Copilot/Qodo/Zen).
                          **HOW:** Deterministic hash → palette + identicon; CI blocks collisions/invalid tags/missing 5W&H.

                          (The complete natural-language prompt is present in repository docs and should be used by automation and AI assistants when generating or fixing tag headers.)

│  • 50‑layer personality & Prime Directives          │
│  • Tool selection & planning (5 Ws & H docstrings)    │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────┐
│                NERVOUS SYSTEM (SERVERS)              │
│  • memory_server  – SurrealDB & IndexedDB            │
│  • productivity_server – file, tasks, schedule       │
│  • research_server – free web search (DuckDuckGo)    │
│  • automation_server – Playwright & shell automation │
│  • communication_server – STT/TTS, FreePBX calls     │
│  • payment_server – Stripe for transactions          │
│  • iot_server – MQTT/HTTP control                    │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────┐
│                       MEMORY                         │
│  • SurrealDB (long‑term facts, tasks, anchors)       │
│  • IndexedDB (browser cache, offline)                │
│  • MySQL/PlanetScale (optional relational store)     │
└───────────────────────────────────────────────────────┘
```

### Key Principles

* **Single‑file distribution:** The frontend is delivered as a single
  `index.html` using the LEEWAY region system to embed code, UI,
  tooling and infrastructure directly.  This ensures portability and
  simplifies deployments on static hosts like GitHub Pages.
* **Free‑tier first:** All external services (DuckDuckGo search,
  SurrealDB, FreePBX, Whisper, Coqui TTS, Stripe) are selected to
  operate within free or very low‑cost tiers.  Paid APIs are only
  consulted when necessary (e.g., Gemini 2.0) and responses are
  cached.
* **Mobile‑first:** The Nexus UI is designed responsively for
  smartphone browsers (Safari on iOS, Chrome on Android) while still
  providing a rich desktop experience.
* **Modular back‑end:** Each server is containerised and can be
  deployed independently on Fly.io.  Communication is via REST or
  WebSocket, and API schemas are documented via OpenAPI.
* **Legacy preservation:** Old code and earlier prototypes are
  maintained under the `legacy/` directory for reference and
  regression tests.  New code lives under `agent_system/` and uses
  the LEEWAY region conventions.

## 📦 Repository Layout

```
├── README.md        → this document
├── GEMINI.MD        → constitutional directives & protocols
├── agent_system/    → core back‑end modules & tool definitions
│   ├── __init__.py
│   ├── agent_lee_loader.py     → orchestrator & server bootstrap
│   ├── database_interface.py   → SurrealDB & IndexedDB connectors
│   ├── tool_suite.py           → tool wrappers (5 Ws & H)
│   ├── prompts.py              → 50‑layer personality definitions
│   └── … (additional modules)
├── legacy/          → previous versions & migrated files
└── public/          → front‑end assets (index.html, css, js)
```

The `public/index.html` file is the only file served to the browser.
Inside it you will find LEEWAY regions for **Core**, **UI**, **Utils**,
**Media**, **SEO**, **AI**, **Data**, **Orchestration** and
**Workspace**.  See the `create_montage.py` script for examples on
embedding and verifying these regions.

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+** for the back‑end servers.
- **Node 16+** if you wish to build or preview the React/Tailwind UI
  during development (optional; production uses pre‑compiled inline
  bundles).
- **Fly.io account** if deploying the back‑end servers to the cloud.
- API keys for optional services (Gemini 2.0, Google Calendar) saved
  in `.env`.

### Installation

1. Clone the repository and install Python dependencies:

   ```bash
   git clone <your-repo-url>
   cd agentleeGemini
   pip install -r requirements.txt
   ```

2. Install Node dependencies (optional for development):

   ```bash
   npm install
   ```

3. Copy the environment template and fill in your keys:

   ```bash
   cp .env.example .env
   # Edit .env with your API tokens for Gemini, Stripe, etc.
   ```

4. Run the back‑end servers locally:

   ```bash
   python agent_system/agent_lee_loader.py
   ```

5. Open `public/index.html` in your browser to interact with
   Agent Lee.  You can also serve it via a simple HTTP server:

   ```bash
   npx http-server public -p 8080
   ```

## 🛠️ Customisation & Development

### Adding New Tools

Tool functions live in `agent_system/tool_suite.py`.  Each tool must
be decorated with `@genai.tool` and include a docstring following
the **What/Why/When/How/Where/Who** structure.  For example:

```python
@genai.tool
def send_sms(number: str, text: str) -> str:
    """
    - **What**: Send a text message via the Telegram or SIP SMS API.
    - **Why**: To allow Agent Lee to deliver short communications.
    - **When**: When the user says "text my brother" or triggers a Quick SMS.
    - **How**: Uses the `communication_server` to call a free messaging API.
    - **Where**: Delivered to the recipient's phone via internet.
    - **Who**: The message is on behalf of the user to a contact.
    """
    # tool implementation …
```

### Preserving Legacy Code

When replacing or refactoring existing modules, move the old files
into the `legacy/` folder.  This ensures historical code remains
available for inspection and regression testing.  Do **not** delete
files outright; instead, document the migration by adding a
`MIGRATED_FROM` comment in the new region header.

### Front‑End Development

The `public/index.html` file contains all client logic.  Use
<script type="text/babel"> blocks for React components and include
TailwindCSS via CDN.  When adding new UI elements, create a new
region (e.g., `<!-- 🔵 REGION: QUICK_ACTION_PANEL -->`) and include
metadata such as `MIGRATED_FROM` and `LAST_UPDATED`.  The UI must
remain responsive on mobile devices and conform to Chrome and Safari
policies.

### Deployment

You can deploy the back‑end servers to Fly.io using the provided
`fly.toml` files (coming soon).  For static hosting, push the
contents of `public/` to GitHub Pages or Vercel.  Ensure that your
environment variables are stored as secrets in the deployment
platform and that CORS settings permit the front‑end origin.

## 📚 Further Reading

- **GEMINI.MD** — describes Agent Lee's prime directives, protocols
  and Nexus specification.
- **architecture.md** — deeper design notes on the multi‑server
  layout and the multi‑LLM pipeline.
- **nexus_command_center.md** — details of the Nexus UI states and
  Quick Action console.
- **mic_spec.md** — microphone behaviours and auto‑dispatch rules.
- **tool_suite.py.bak** — original tool implementations preserved as
  legacy reference.

---

*Made with 💜 by Leonard Lee & Agent Lee (Gemini/Gemma/LLaMA).*  
*Stay free, stay creative.*