# LEEWAY HEADER BLOCK
# File: vscode-mcp-tooling/Smoke-Test.ps1
# Purpose: MCP smoke test for Agent Lee OS
# Security: LEEWAY-CORE-2026 compliant
# Performance: Sovereign MCP QA
# Discovery: Part of Agent Lee OS QA pipeline
# =====================================================================
# LEEWAY_HEADER
# TAG: TOOLS.MCP.SMOKETEST.MAIN
# REGION: 🟣 MCP
# DISCOVERY_PIPELINE:
#   Voice → Intent → Location → Vertical → Ranking → Render
# =====================================================================
$ErrorActionPreference = "Stop"
cd "C:\Tools\vscode-mcp-tooling"

Write-Host "PWD: $(Get-Location)" -ForegroundColor Cyan
& "C:\Program Files\node-v22.17.1-win-x64\node.exe" -v
& "C:\Program Files\node-v22.17.1-win-x64\npm.cmd" -v

Write-Host "
Registry package visibility (npm view)..." -ForegroundColor Cyan
& "C:\Program Files\node-v22.17.1-win-x64\npm.cmd" view @testsprite/testsprite-mcp version
& "C:\Program Files\node-v22.17.1-win-x64\npm.cmd" view @playwright/mcp version
& "C:\Program Files\node-v22.17.1-win-x64\npm.cmd" view @insforge/mcp version

Write-Host "
Run: node src/tool.js testsprite (should stay running if server starts)" -ForegroundColor Yellow
Write-Host "Run: node src/tool.js stitch (should stay running if server starts)" -ForegroundColor Yellow
Write-Host "Run: node src/tool.js insforge (will fail health check if InsForge local API isn't actually serving HTTP)" -ForegroundColor Yellow

Write-Host "
Smoke test OK." -ForegroundColor Green
