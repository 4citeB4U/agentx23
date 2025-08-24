Migration notes — canonicalization and legacy archives

Overview

This project was reorganized to make the backend the canonical Python source and the frontend the canonical SPA assets. During the reorg duplicate/legacy files were archived into `legacy/` so the working tree is small and imports remain stable.

Canonical locations

- Backend Python (canonical): `backend/`
  - Main FastAPI app: `backend/app.py`
  - Canonical tool suite: `backend/tool_suite.py`
  - Gradio test components: `backend/gradio_tools.py`, `backend/gradio_mcp_runner.py`

- Frontend SPA: `frontend/public/` (index and static files), `frontend/models/` (browser models)

Legacy / archived files

- Archived frontend scripts (moved out of `frontend/scripts/`):
  - `legacy/archived_20250824_frontend-scripts/` contains original Leeway scripts and helpers (e.g. `main.js`, `sw.js`, `tool_components.js`, `_compute_tags.mjs`, `leeway-fix.mjs` etc.)

- Archived Python duplicates:
  - `legacy/archived_20250824_python-duplicates/` contains older copies of `app1.py`, older `tool_suite` variants, and other historical artifacts.

Compatibility

- To support older imports during the migration, thin shim modules were used temporarily (for example under `agentleeGemini/agent_system`). Those shims have been replaced so callers now import the canonical `backend.tool_suite` behavior (structured dict results and async functions). If you still rely on older string-returning wrappers, update your callers to consume canonical dict results or re-add thin wrappers in your integration layer.

Tests and CI

- Unit tests live under `tests/` and now target the canonical backend implementations.
- A GitHub Actions workflow runs `pytest` on push and pull_request to prevent regressions.

How to run locally

- Install dependencies from `requirements.txt` (consider using a venv):

```pwsh
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest -q
```

If you need help migrating older callers (for example UI code expecting string results), open an issue or ask for a small compatibility adapter.
