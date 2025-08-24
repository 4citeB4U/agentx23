# Frontend (LEW SPA)

This folder contains the Single Page App (LEW runtime) used by AgentLee Gemini.

Structure

- `public/index.html` — the SPA entrypoint that bootstraps the LEW runtime.
- `models/` — ES modules for browser LLM runtimes and embedder (phi3, gemma, llama, embedder, lee-search).
- `scripts/` — helper scripts and service worker; some leeway maintenance scripts live here for CI.

How it loads

- The SPA imports modules from `/models` and `/scripts` (absolute paths) which are served by the backend static mounts during development.
- Modules expose constructors and instances on `window`, e.g. `window.Embedder`, `window.Phi3LLM`, `window.LeeSearch`.

Notes

- When deploying, either bundle the modules into the public build or ensure the server serves the `models/` and `scripts/` directories at the expected paths.
- The LEW tool registry (`window.LEW.tools`) uses `/api/tool/*` endpoints for backend-assisted tools.
