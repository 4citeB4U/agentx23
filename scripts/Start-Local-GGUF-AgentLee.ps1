# LEEWAY HEADER BLOCK
# File: scripts/Start-Local-GGUF-AgentLee.ps1
# Purpose: Start local llama.cpp GGUF model servers + Agent Lee brain/backend stack
# Security: LEEWAY-CORE-2026 compliant
# Performance: Optimized for sovereign local inference boot

[CmdletBinding()]
param(
  [string]$Python = "py -3.12",
  [string]$ModelsRoot = "C:\models"
)

$ErrorActionPreference = "Stop"

$model05 = Join-Path $ModelsRoot "qwen2.5-0.5b-instruct-q4_k_m.gguf"
$model15 = Join-Path $ModelsRoot "qwen2.5-1.5b-instruct-q4_k_m.gguf"
$model3b = Join-Path $ModelsRoot "qwen2.5-3b-instruct-q4_k_m.gguf"

foreach ($m in @($model05, $model15, $model3b)) {
  if (-not (Test-Path $m)) {
    throw "Missing model file: $m"
  }
}

function Stop-Port([int]$Port) {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
    }
}

# Clear known ports to avoid WinError 10048 collisions
6000,6001,6003,6004,8000,8007,8080,8081,8082 | ForEach-Object { Stop-Port $_ }

$root = "C:\Tools\Portable-VSCode-MCP-Kit"
Set-Location $root

# Launch llama.cpp servers (OpenAI-compatible)
Start-Process pwsh -WindowStyle Minimized -ArgumentList @(
  "-NoProfile","-Command",
  "$Python -m llama_cpp.server --host 127.0.0.1 --port 8082 --model `"$model05`" --n_ctx 2048 --n_threads 8"
)

Start-Process pwsh -WindowStyle Minimized -ArgumentList @(
  "-NoProfile","-Command",
  "$Python -m llama_cpp.server --host 127.0.0.1 --port 8080 --model `"$model15`" --n_ctx 2048 --n_threads 8"
)

Start-Process pwsh -WindowStyle Minimized -ArgumentList @(
  "-NoProfile","-Command",
  "$Python -m llama_cpp.server --host 127.0.0.1 --port 8081 --model `"$model3b`" --n_ctx 2048 --n_threads 8"
)

# Launch brain (Python 3.12)
Start-Process pwsh -WindowStyle Minimized -ArgumentList @(
  "-NoProfile","-Command",
  "$env:NEURAL_ROUTER_PORT='6004'; $Python server.py"
)

# Launch backend
Start-Process pwsh -WindowStyle Minimized -ArgumentList @(
  "-NoProfile","-Command",
  "Set-Location '$root'; $env:PORT='6001'; $env:WS_PORT='6003'; $env:NEURAL_ROUTER_PORT='6004'; node backend/dist/index.js"
)

Write-Host "Started local GGUF + Agent Lee services:"
Write-Host "  llama 0.5b: http://127.0.0.1:8082"
Write-Host "  llama 1.5b: http://127.0.0.1:8080"
Write-Host "  llama 3b:   http://127.0.0.1:8081"
Write-Host "  brain:      http://127.0.0.1:6004"
Write-Host "  backend:    http://127.0.0.1:6001"
Write-Host "  ui:         http://127.0.0.1:6001"
Write-Host ""
Write-Host "Run this health check after ~20s:"
Write-Host "  Invoke-RestMethod http://127.0.0.1:6001/health"
Write-Host "  Invoke-RestMethod http://127.0.0.1:6004/health"
Write-Host "  Invoke-RestMethod http://127.0.0.1:8080/v1/models"
