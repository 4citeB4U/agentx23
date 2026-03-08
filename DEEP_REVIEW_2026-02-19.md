<!-- LEEWAY HEADER BLOCK -->
<!-- File: DEEP_REVIEW_2026-02-19.md -->
<!-- Purpose: Agent Lee OS deep review evidence -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Optimized for sovereign agentic review -->
<!-- Discovery: Part of Agent Lee OS compliance and evidence pipeline -->

# Deep Review — Agent Lee OS (2026-02-19)

## Scope

This review covers:

- Frontend: `.Agent_Lee_OS/` (Agent Lee OS)
- Backend: `backend/` (Express + security middleware + routes)
- Brain Router: `server.py` (FastAPI)
- Desktop Hands: `scripts/desktop_agent.py` (FastAPI + PyAutoGUI)
- MCP Bridge: `vscode-mcp-tooling/` (HTTP bridge to MCP packages)
- Ops: `Run-All.ps1`, `ecosystem.config.cjs`

## Current Architecture (as-built)

- **Frontend (8000)**: Vite/React UI with tabs: COMMS, LIVE, FILES, CODE, SYSTEM.
- **Backend (8001)**: Express API + security middleware. Serves API under `/api/*` and can serve static OS build.
- **WebSocket (8003)**: Backend WS bridge.
- **MCP Bridge (8002)**: Local HTTP server that can run MCP packages via POST routes and expose `/health`.
- **Brain Router (8004)**: `server.py` health + chat + TTS (handshake-protected).
- **Desktop Agent (8005)**: Screenshot + input execution (handshake-protected).

## What’s Strong

- **One-command lifecycle**: `Run-All.ps1` (PM2 ecosystem) now supports `start/stop/restart/status/verify` and `verify` is HTTP-level.
- **LIVE control pipeline is real**: `/api/device/screenshot` + `/api/device/act` with mobile-safe trackpad support and corrected coordinate mapping.
- **Security layering**: handshake allowlist for selected routes + full device-HMAC signing for higher assurance paths.
- **Filesystem gateway**: `/api/fs/*` root-alias allowlist + blocked patterns + audit logging is a solid baseline.

## Critical Risks (fix ASAP)

### 1) Secrets in-repo (very high)

- `.env.local` contains many production-grade secrets and tokens.
- `scripts/send_telegram.py` previously hardcoded Telegram bot token and user ID.

**Status**: mitigations applied

- Added root `.gitignore` to prevent committing `.env.local` and `.chrome-devtools/`.
- Updated `scripts/send_telegram.py` to load credentials from `.env.local` and stopped sending device secrets by default.

**Follow-up** (recommended):

- Rotate any credentials that have ever been committed.
- Add an `.env.example` template and keep `.env.local` only local.

### 2) LIVE input auth surface (high)

- `/api/device/act` is handshake-allowed. This is necessary for phone control, but it means the handshake secret is effectively a “remote admin key”.

**Recommendations**:

- Add server-side rate limiting per IP/device for `/api/device/act`.
- Consider splitting actions into “safe” vs “dangerous” (e.g., typing/clicking vs launching shell commands).

### 3) Frontend HTML uses CDN Tailwind + importmap (medium/high)

- `.Agent_Lee_OS/index.html` loads Tailwind via CDN and uses an import map for major deps.

**Impact**:

- Harder to operate offline.
- Extra third-party runtime dependency (supply chain + availability).

**Recommendation**:

- Convert to fully bundled deps (Tailwind as PostCSS + local deps) and remove importmap/CDN usage.

## Security Boundary Review (key notes)

- `backend/src/services/security.ts` now allows handshake access for:
  - `/api/device/screenshot` (GET)
  - `/api/device/act` (POST)
  - `/api/fs/*` (all)
  - `/api/services/runtime` (GET)
  - `/api/chat` (all)
- All other routes require device enrollment + HMAC signature headers.

**Recommendation**:

- Document “handshake routes” explicitly in README so operators understand the trust boundary.

## Mobile/Phone UX Review (LIVE)

Observed failure modes were:

- Overlapping control panel due to fixed-height layout and fixed bottom nav.
- iOS pointer events reporting `buttons=0`, preventing trackpad drag.

**Status**: fixes applied

- RemoteView input controls now auto-size and sit above the bottom nav.
- Trackpad drag works on iOS by tracking pointer capture instead of relying on `event.buttons`.

## Reliability / Ops Review

- Preferred entrypoint:
  - `Run-All.ps1 restart` (boot + verify)
  - `Run-All.ps1 stop`
  - `Run-All.ps1 verify`
- `ecosystem.config.cjs` correctly defines services and ports.

**Recommendation**:

- Keep `Start-AgentLee.ps1` as a thin wrapper (already done) to avoid multiple competing boot scripts.

## Testing Review

- `.Agent_Lee_OS/scripts/verify-ui-persona.mjs` is a good lightweight smoke test.
- It now includes a hit-target/overlap check for LIVE controls.

**Recommendation**:

- Add a backend contract test for `/api/device/act` (handshake auth + schema validation).

## Prioritized Punch List

P0 (security):

- Rotate any credentials that were committed in `.env.local`.
- Ensure `.env.local` is not tracked and is removed from git history if this repo is shared.

P1 (stability):

- Add explicit error UI in LIVE for 401/403 with “handshake missing/mismatch” hints.
- Add basic per-route request throttling for screenshot/act.

P2 (product):

- Remove CDN Tailwind/importmap from `.Agent_Lee_OS/index.html` (bundle locally).

P3 (observability):

- Expand `Run-All.ps1 verify` to also check `/api/services/health` and WS readiness.

---

If you want, I can convert the P0/P1 items into concrete PR-sized patches next (starting with rate limiting + clearer 401/handshake UI in LIVE).
