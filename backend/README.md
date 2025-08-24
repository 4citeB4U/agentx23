# Backend (FastAPI)

This folder contains the FastAPI backend for the AgentLee Gemini project.

How to run

- Create a Python 3.10+ virtual environment and install requirements:
  - python -m venv .venv
  - source .venv/Scripts/Activate.ps1 (PowerShell)
  - python -m pip install -r requirements.txt
- Start the server (development):
  - uvicorn backend.app:app --reload --port 5175

Key endpoints

- GET /health — basic health check
- GET /api/capabilities — returns provider and capability listing
- POST /api/tool/fs — filesystem tool (manage_file_system)
- POST /api/tool/shell — run sandboxed shell commands (may be restricted)
- POST /api/tool/deep_research — request deep research tool (DDG/Wiki)
- POST /api/voice/clone — voice cloning (requires OpenVoice)
- POST /api/voice/synthesize — SSML-based synthesize

Notes

- The backend serves frontend static files and also mounts `/models` and `/scripts` when used in development; ensure paths are consistent if you deploy behind a reverse proxy.
- Legacy or duplicate entrypoints have been archived under `/legacy`.
