Agent Lee Restoration — Agents & Initial Checklists

Overview

- Purpose: Restore full live voice, visual morphing, UI interactions, file explorer, and stability for Agent Lee.
- Use the local MCPs and services available in the workspace (neural router, llama_cpp endpoints, PocketTTS chain) for verification.

Agents

1. Verifier (Agent-Verifier)

- Role: Discovery and runtime verification.
- Responsibilities:
  - Confirm ports/services running: backend (6001), frontend (6000), ws (6003), neural router (6004), llama_cpp endpoints (8080/8081/8082).
  - Check logs for errors and resource limits.
  - Verify handshake keys and origin checks.
- Deliverables: `verifier/report-{timestamp}.md` with status and failing endpoints.

2. Preparer (Agent-Preparer)

- Role: Install, configure, and start dependent services.
- Responsibilities:
  - Ensure Python deps installed: `fastapi`, `uvicorn`, `httpx`, `edge-tts`, `python-dotenv`, `pydantic`.
  - Ensure Node deps built: `npm install` + `npm run build` for backend and frontend.
  - Start local model servers (llama_cpp) and PocketTTS chain; verify `/v1/models`.
- Deliverables: startup scripts and status logs.

3. Orchestrator (Agent-Orchestrator)

- Role: Real-time audio flow and model routing.
- Responsibilities:
  - Implement/validate live mic -> browser MediaStream -> WebSocket/RTC to backend.
  - Ensure backend routes audio to neural router which picks model (0.5B, 1.5B, 3B) and returns transcripts/decisions.
  - Wire transcription to LLM input streaming and route LLM replies to PocketTTS for immediate speech.
  - Ensure low-latency streaming and proper backpressure handling.
- Deliverables: `orchestrator/flow.md`, integration patches to `CodeStudio.tsx` and backend ws/terminal routes if needed.

4. Visuals & UX (Agent-Visuals)

- Role: Avatar shapes/particles + UI interaction fixes.
- Responsibilities:
  - Restore canonical Agent Lee solids (teddy, pencil, etc.) and ensure particle system maps to solid geometry.
  - Fix mic button state (red when listening), enable immediate transcription while pressed/toggled.
  - Fix File Explorer wiring, Settings panels, and Charts behavior (open/widen interactions).
- Deliverables: asset list, `VoxelCore.tsx` patches, `CodeStudio.tsx` UI fixes, visual test harness.

MCP / Tools to Use (local)

- `llama_cpp` servers at ports 8080/8081/8082
- Neural router service at port 6004 (server.py)
- Backend at 6001 (backend/dist/index.js)
- Frontend dev server at 6000 (Vite)
- PocketTTS chain invoked via `scripts/_speak.py` / `edge-tts` pip packages

Initial checks & commands (run by Agent-Preparer / Verifier)

Windows / PowerShell quick commands:

```powershell
# Check services
Invoke-WebRequest http://127.0.0.1:6001/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:6004/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8082/v1/models -UseBasicParsing

# Build backend
Set-Location backend
npm install
npm run build

# Start backend (with env vars)
$env:PORT='6001'; $env:WS_PORT='6003'; $env:NEURAL_ROUTER_PORT='6004'; node dist/index.js

# Start frontend
Set-Location .Agent_Lee_OS
npx vite --host 127.0.0.1 --port 6000 --strictPort

# Start python server (neural router)
$env:NEURAL_ROUTER_PORT='6004'; py -3.12 server.py
```

Next steps

- I will implement `Agent-Verifier` checks and produce the first runtime report, then start `Agent-Preparer` tasks to bring up the voice stack.
- After that, we will patch UI mic behavior and the orchestrator flow.
