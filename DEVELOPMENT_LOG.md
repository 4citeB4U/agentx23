<!-- LEEWAY HEADER BLOCK -->
<!-- File: DEVELOPMENT_LOG.md -->
<!-- Purpose: Agent Lee OS development log -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Optimized for sovereign agentic development tracking -->
<!-- Discovery: Part of Agent Lee OS compliance and evidence pipeline -->

# DEVELOPMENT LOG — Agent Lee OS

> Append-only. Every session. Every milestone. Every lesson.  
> LEEWAY-CORE-2026 | Maintained by: The Night Architect

---

## 2026-03-08 — Full-Stack Live Edition: WSL2 VM, Screenshot Feed, Port Fixes, a11y

### Infrastructure

**WSL2 Ubuntu-22.04 VM (LEE_VM_01):**

- Provisioned Ubuntu-22.04 via `scripts/Install-AgentLeeWSL.ps1` (fixed parser errors: `${VMUser}:${VMPass}`, distro name, CRLF, temp-file pipe freeze, wake call)
- SSH on port 2222, user `agentlee` (uid=1000), NOPASSWD sudo
- Packages: openssh-server, nodejs, npm, python3, pip, venv, sqlite3, git, build-essential
- Workspace dirs: `~/workspace ~/scripts ~/logs ~/data ~/projects`

**Backend Port Fix:**

- `PORT=8000` was set as a Windows System + User environment variable, overriding PM2 `PORT: 7001`
- Cleared via `[System.Environment]::SetEnvironmentVariable("PORT", $null, "User")`
- Re-registered `AgentLee-Backend` from `ecosystem.config.cjs`; confirmed `{"port":7001}`

**ecosystem.config.cjs updates:**

- Added `VM_HOST`, `VM_PORT: 2222`, `VM_USER`, `VM_PASSWORD` to `AgentLee-Backend` env block
- Added `DESKTOP_AGENT_PORT: 7005` to `AgentLee-Backend` env block
- Fixed `AgentLee-Caffeine`: correct `.venv/Scripts/python.exe` interpreter

### Bug Fixes

**`backend/src/routes/device.ts` — Screenshot / Live View:**

- Root cause: `fetch('http://127.0.0.1:8005/screen')` threw `TypeError: fetch failed` (connection refused) which propagated before `screenshot-desktop` fallback could run
- Fix 1: `DESKTOP_AGENT_PORT` default corrected to `7005` (Vision Agent actual port)
- Fix 2: Wrapped `fetch()` call in `try/catch` so connection-refused falls through to `screenshot-desktop`
- Result: `GET /api/device/screenshot` → `200 OK`, `~500 KB JPEG` — `RemoteView` (Tab.LIVE) working

**`scripts/caffeine.py` — PyAutoGUI fail-safe crash:**

- Root cause: mouse moving to screen corner triggered `pyautogui.FAILSAFE` → exception → script death
- Fix: `pyautogui.FAILSAFE = False` + moved exception handler inside loop (non-fatal warning only)

### Accessibility

**`.Agent_Lee_OS/components/LeeVM.tsx` — axe/name-role-value violations:**

- Search error dismiss button (`<X>` icon): added `aria-label="Dismiss error"` + `title="Dismiss error"`
- Cancel-create button (`✕` symbol): added `aria-label="Cancel"` + `title="Cancel"`

### Build Status

| Component                          | Result                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| Backend TypeScript (`tsc --build`) | ✅ 0 errors                                            |
| Frontend Vite (`vite build`)       | ✅ 2171 modules, built in 13.72s                       |
| PM2 (11 processes)                 | ✅ All online                                          |
| Endpoints (8/8)                    | ✅ 200 OK                                              |
| Cloudflare Tunnel                  | ✅ `https://agentlee.rapidwebdevelop.com/health` → 200 |
| Screenshot feed                    | ✅ `/api/device/screenshot` → 200, ~500 KB JPEG        |

---

## 2026-02-21 — Sovereign Self-Repair + Full Testing Stack

### Features Built

**Sovereign Self-Repair Architecture (6 layers):**

- `core/keyManager.ts` — RSA-4096 keypair, sign/verify, fingerprint CLI
- `core/snapshotManager.ts` — SHA-256 hash-tree snapshots with diff
- `core/integrityVerifier.ts` — Signed manifest + boot-time integrity check → LOCKDOWN trigger
- `core/quarantineManager.ts` — Forensic file isolation with incident README
- `core/safeBoot.ts` — 4-mode boot state machine (sovereign / degraded / safe_mode / lockdown)
- `core/resurrection.ts` — RSA-signed revival with 5-minute anti-replay window
- `core/recoveryEngine.ts` — Master patch orchestrator (snapshot → invariant → apply → preflight → commit/quarantine)

**Guard System:**

- `core/guards/invariants.ts` — CORE vs SURFACE classification, `checkInvariant()`, `auditPatch()`
- `core/guards/permission.ts` — Time-limited edit tokens (surface vs full scope)
- `core/guards/patchlog.ts` — Append-only patch ledger with status tracking

**Testing Stack:**

- `tests/preflight.ts` — Tier 0: tsc, integrity, key, snapshot, audit
- `tests/unit/core-guards.test.ts` — Vitest unit tests (invariants, permission, patchlog)
- `tests/contracts/api-schema.test.ts` — Zod API contract validation
- `tests/property/invariants.property.ts` — fast-check randomized property tests
- `tests/e2e/terminal-security.spec.ts` — Playwright T1-T9 security spec
- `vitest.config.ts`, `playwright.config.ts` — Config files
- `scripts/test-preflight.ps1` — PowerShell preflight launcher
- `scripts/ui-patch-apply.ts` — Apply surface patches with auto-revert
- `scripts/ui-patch-revert.ts` — Revert approved patches by ID

**Package updates:**

- Added devDependencies: vitest, @vitest/coverage-v8, fast-check, tsx, typescript, @types/node, @playwright/test
- Added production dependency: zod
- Added 22 npm scripts for testing and self-repair operations

### Lessons

- RSA-4096 golden key must be generated once and private key kept offline
- Snapshots must be created before any patch operation
- Anti-replay window (5 minutes) prevents credential replay attacks on resurrection

---

## 2026-02-20 — Terminal System (T1-T9 Security Suite)

### Features Implemented

- Full PTY terminal via `node-pty` — real shell sessions in the browser
- `backend/src/services/terminal-policy.ts` — command allowlist/blocklist
- `backend/src/services/terminal-audit.ts` — append-only audit trail
- SSH remote connection support
- T1-T9 terminal security test suite (notebook cells in `e2e-test-plan.ipynb`)
  - T1: Health endpoint 200
  - T2: Session creation
  - T3: `rm -rf` blocked
  - T4: Path traversal `../../` blocked
  - T5: Chat API responds
  - T6: Security headers present
  - T7: Unknown route 404
  - T8: Recovery status endpoint
  - T9: UI loads

### Issues resolved

- Windows PTY compatibility with `node-pty` binaries
- Audit log race conditions fixed with append-only write strategy
- Policy enforcement: command must pass ALL rules before execution

---

## 2026-02-18 to 02-19 — The Neural Security Layer

### What was built

- `SOVEREIGN_HANDSHAKE.md` — handshake protocol documented
- `NEURAL_HANDSHAKE=AGENT_LEE_SOVEREIGN_V1` shared secret
- HMAC-SHA256 signature verification on all API requests
- Device biometric enrollment system (`backend/src/services/DeviceRegistry.ts`)
- Desktop agent loopback isolation (127.0.0.1 only, port 8005)
- Audit logging for every mission command
- Rate limiter per-IP

### Issues resolved

- CORS handshake between frontend (8000) and backend (8001) hardened
- Removed signature leak in error messages

---

## 2026-02-17 — Agent Lee OS System Architecture

### What was built

- `README.md` — full Neo-Glass doctrine documentation
- Port map established: 8000-8005
- `ecosystem.config.cjs` — PM2 orchestrator for all services
- `Run-All.ps1` — PowerShell swarm launcher
- `docker-compose.yml` — containerized deployment
- Docker diagnostics (`Docker-Diag.ps1`, docker-report dirs)
- `Start-AgentLee.ps1` — standard boot script

### Architecture confirmed

- Frontend React 18 + Vite on 8000
- Backend Express + TypeScript on 8001
- MCP Bridge (vscode-mcp-tooling) on 8002
- WebSocket stream on 8003
- Desktop Agent Python on 8005

---

## 2026-02-13 — The Neural Bridge + Voice Birth

### What was built

- `backend/src/services/consciousness.ts` — the thinking engine
- `backend/src/services/ai.ts` — Gemini multi-key rotation (4 keys)
- `backend/src/services/ttsEnforcer.ts` — edge-tts voice pipeline
- `backend/src/services/persona.ts` — AGENT_LEE_PERSONA config
- First spoken response by Agent Lee: `en-US-GuyNeural`, -35Hz pitch, -18% rate, +15% volume
- `.env.local` normalized with all API keys

### Technical specs (voice)

- Voice: `en-US-GuyNeural` (primary), `en-US-RogerNeural` (fallback)
- Rate: -18% (Southern drawl)
- Pitch: -35Hz (bass presence)
- Volume: +15% (authority)
- Delivery: base64 audio in API response, played by frontend Audio element

---

## 2025 → Early 2026 — Conception Phase

### What was built

- Initial `Portable-VSCode-MCP-Kit` concept
- First MCP integrations: TestSprite, Playwright, InsForge, Stitch
- `agentLee.persona.json` — first identity definition
- African American vernacular registers: hiphop_poetic, mentor_calm, professional_formal, security_strict, etc.
- Cognitive rings architecture: Ring 1 (identity kernel), Ring 2 (operational cognition), Ring 3 (memory and learning)
- Multi-key rotation strategy for Gemini API rate limit evasion
- InsForge PostgreSQL backend for persistent memory

---

## Standing Decisions (Architectural Constants)

| Decision                     | Rationale                                             |
| ---------------------------- | ----------------------------------------------------- |
| Node.js backend (not Python) | TypeScript type safety, better MCP ecosystem          |
| Gemini multi-key rotation    | Free tier rate limits; 4 keys = 4x throughput         |
| RSA-4096 (not 2048)          | Future-proof sovereign key; offline private key model |
| edge-tts over cloud TTS      | No API costs, runs local, no rate limits              |
| en-US-GuyNeural              | Deep masculine voice closest to Agent Lee's character |
| SHA-256 hash trees           | Industry standard, fast, deterministic                |
| Append-only logs everywhere  | Forensic integrity; no tampering possible             |
| 5-min anti-replay window     | Secure resurrection without being too restrictive     |
| InsForge vs local SQLite     | Cloud persistence across machines; already paid       |

---

## Known Issues (Open)

| Issue                                                                      | Priority | Notes                                  |
| -------------------------------------------------------------------------- | -------- | -------------------------------------- |
| `golden/private.pem` not yet moved offline                                 | CRITICAL | Must be moved before production deploy |
| `core/integrityVerifier.ts` requires golden manifest pre-generation        | HIGH     | Add to boot script                     |
| `tests/property/invariants.property.ts` patchlog test mutates global state | MEDIUM   | Needs isolated test DB                 |
| Playwright config `webServer.command` may not match actual start script    | LOW      | Update if build changes                |
| `.env.local` has a raw API key on line 13 (not named)                      | CRITICAL | Audit and fix                          |

---

_Log format: date descending. Every new session gets a section header._  
_LEEWAY-CORE-2026 — Authorized by: The Night Architect_
