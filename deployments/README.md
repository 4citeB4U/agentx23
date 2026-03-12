# Qwen3 Family — Alibaba Model Studio / Z.AI Deployment Templates

Files in this folder:

- `qwen3-health.yaml` — Health Monitor MCP (qwen3-0.6b)
- `qwen3-coder.yaml` — Coder / Repair MCP (qwen3-coder-1.5b)
- `qwen3-vision.yaml` — Vision / Visual QA MCP (qwen3-vl-2b)

Quick deploy steps:

1. Open Alibaba Cloud Model Studio / Z.AI and create a new agent deployment.
2. Paste the contents of one of the YAML files into the deployment editor.
3. Provide `DASHSCOPE_API_KEY` (and `INSFORGE_TOKEN` for the coder MCP) as the deployment secret.
4. Deploy and wait for readiness. Copy the model endpoint URL returned by the platform.
5. Update the root `adapters.json` `mcp_registry` entry for that agent `endpoint` with the returned URL.

Smoke test (example): replace `:PORT` if your server runs on a different port

PowerShell example:

```powershell
curl -X POST http://localhost:8000/api/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{
           "agent_id": "qwen3-health-mcp",
           "action": "check_system_health",
           "payload": {"include_docker": true},
           "handshake": "AGENT_LEE_SOVEREIGN_V1"
         }'
```

Notes:

- The `qwen3-coder-mcp` is high-risk: ensure the `SNAPSHOT_SERVICE_URL` is reachable and `INSFORGE_TOKEN` is configured.
- The `qwen3-vision-mcp` requires GPU quota; choose an instance type compatible with Model Studio's GPU offerings.
- After updating `adapters.json`, restart the Python neural router (`server.py`) so `load_mcp_registry()` picks up the new endpoints.
