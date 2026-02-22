# =====================================================================
# Agent Lee Studio - Unified Stack Entry
# Canonical entrypoint is Run-All.ps1 (PM2 ecosystem + verify)
# =====================================================================

param(
    [ValidateSet('start', 'stop', 'restart', 'status', 'verify')]
    [string]$Action = 'restart'
)

$ErrorActionPreference = 'Stop'

$root = 'C:\Tools\Portable-VSCode-MCP-Kit'
$runner = Join-Path $root 'Run-All.ps1'

if (-not (Test-Path $runner)) {
    throw "Missing stack runner: $runner"
}

Write-Host "[INFO] Delegating to $runner $Action" -ForegroundColor Cyan
& $runner -Action $Action
