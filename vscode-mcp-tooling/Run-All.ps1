# LEEWAY HEADER BLOCK
# File: vscode-mcp-tooling/Run-All.ps1
# Purpose: MCP orchestrator for Agent Lee OS
# Security: LEEWAY-CORE-2026 compliant
# Performance: Sovereign MCP orchestration
# Discovery: Part of Agent Lee OS QA pipeline
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot"
Write-Host "PWD: $PSScriptRoot" -ForegroundColor Cyan
node src/tool.js testsprite
node src/tool.js playwright
node src/tool.js insforge
node src/tool.js stitch
