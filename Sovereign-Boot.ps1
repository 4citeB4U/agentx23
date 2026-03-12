# LEEWAY HEADER BLOCK
# File: Sovereign-Boot.ps1
# Purpose: Sovereign boot sequence for Agent Lee OS
# Security: LEEWAY-CORE-2026 compliant
# Performance: Optimized for sovereign agentic boot
# Discovery: Part of Agent Lee OS boot pipeline
# =====================================================================
# Agent Lee Studio - Sovereign Boot Script
# Launches the persistent PM2 ecosystem for the Sovereign Hybrid Core
# =====================================================================

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Agent Lee OS - Initiating Sovereign Boot" -ForegroundColor Cyan  
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Check if PM2 is installed (Global or Local)
$PM2 = "pm2"
if (!(Get-Command $PM2 -ErrorAction SilentlyContinue)) {
    $PM2 = ".\node_modules\.bin\pm2"
    if (!(Test-Path $PM2)) {
        Write-Host "⚠ PM2 not found. Installing local persistence layer..." -ForegroundColor Yellow
        npm install pm2
    }
}

# 2. Launch Ecosystem
Write-Host "🚀 Launching Neural Ecosystem via $PM2..." -ForegroundColor Cyan
& $PM2 start ecosystem.config.cjs

# 3. Save for Reboot Persistence
Write-Host "💾 Locking system state for reboot persistence..." -ForegroundColor Yellow
& $PM2 save

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   Mission Ready: Sovereign State Active" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor Yellow
Write-Host "  • Frontend Studio: http://localhost:6000" -ForegroundColor White
Write-Host "  • Backend API:     http://localhost:6001" -ForegroundColor White
Write-Host "  • MCP Bridge:      http://localhost:6002" -ForegroundColor White
Write-Host "  • Neural Router:   http://localhost:6004" -ForegroundColor White
Write-Host "  • Desktop Hands:   http://localhost:6005" -ForegroundColor White
Write-Host "  • Ngrok Dashboard: http://localhost:4040" -ForegroundColor White
Write-Host ""
Write-Host "Monitor Status: run 'pm2 monit' or check the Studio Telemetry HUD." -ForegroundColor Gray
Write-Host ""
