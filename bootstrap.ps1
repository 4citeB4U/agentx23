#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# Agent Lee OS — One-Command Windows Bootstrap
# Run: .\bootstrap.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AGENT LEE OS — SOVEREIGN BOOT SEQUENCE              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Build backend TypeScript ────────────────────────────────────────────
Write-Host "  [1/6] Building backend..." -ForegroundColor Yellow
Push-Location "$ROOT\backend"
npm run build
Pop-Location
Write-Host "  ✅  Backend built" -ForegroundColor Green

# ── 2. Build Agent Lee UI ──────────────────────────────────────────────────
Write-Host "  [2/6] Building Agent Lee UI..." -ForegroundColor Yellow
Push-Location "$ROOT\.Agent_Lee_OS"
npm run build
Pop-Location
Write-Host "  ✅  UI built" -ForegroundColor Green

# ── 3. Ensure venv + deps ──────────────────────────────────────────────────
Write-Host "  [3/6] Checking Python venv..." -ForegroundColor Yellow
$venv = "$ROOT\.venv\Scripts\python.exe"
if (-not (Test-Path $venv)) {
    Write-Host "  Creating venv..." -ForegroundColor Yellow
    python -m venv "$ROOT\.venv"
}
& $venv -m pip install -q requests python-dotenv edge-tts fastapi uvicorn
Write-Host "  ✅  Python deps ready" -ForegroundColor Green

# ── 4. Start backend (PM2 or direct) ──────────────────────────────────────
Write-Host "  [4/6] Starting backend on :8001..." -ForegroundColor Yellow
Push-Location "$ROOT"
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 start ecosystem.config.cjs --env production 2>&1 | Out-Null
    Write-Host "  ✅  PM2 stack started" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  PM2 not found — starting backend directly (background)" -ForegroundColor Yellow
    Start-Process -FilePath "node" `
        -ArgumentList "$ROOT\backend\dist\index.js" `
        -WorkingDirectory $ROOT `
        -WindowStyle Hidden
}
Pop-Location
Start-Sleep -Seconds 3

# ── 5. Start desktop agent ─────────────────────────────────────────────────
Write-Host "  [5/6] Starting Desktop Agent on :8005..." -ForegroundColor Yellow
Start-Process -FilePath $venv `
    -ArgumentList "$ROOT\scripts\desktop_agent.py" `
    -WorkingDirectory $ROOT `
    -WindowStyle Hidden
Start-Sleep -Seconds 2
Write-Host "  ✅  Desktop agent started" -ForegroundColor Green

# ── 6. Health check ────────────────────────────────────────────────────────
Write-Host "  [6/6] Running health check..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    $health = Invoke-RestMethod "http://localhost:8001/health" -TimeoutSec 5
    Write-Host "  ✅  Backend health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  ❌  Backend not yet responding — check logs" -ForegroundColor Red
}

try {
    $sys = Invoke-RestMethod "http://localhost:8001/api/services/system/health" `
        -Headers @{ "x-neural-handshake" = (Get-Content "$ROOT\.env.local" | Select-String "NEURAL_HANDSHAKE=(.+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }) } `
        -TimeoutSec 5
    Write-Host "  ✅  System health endpoint live — brain=$($sys.services.brain) desktop=$($sys.services.desktop)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  System health aggregator not yet responding" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Agent Lee OS is SOVEREIGN." -ForegroundColor Cyan
Write-Host "  UI  → http://localhost:8001" -ForegroundColor White
Write-Host "  API → http://localhost:8001/health" -ForegroundColor White
Write-Host ""
