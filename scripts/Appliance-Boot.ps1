# LEEWAY v12 HEADER
# File: scripts/Appliance-Boot.ps1
# Purpose: Pi-Appliance staged boot for Agent Lee OS.
# Stage A: Environment validation (handshake env, persona file, episodes.db)
# Stage B: Core PM2 services (Backend, Brain, Tunnel) - waits for HTTP 200 each
# Stage C: Optional PM2 services (Frontend, PocketTTS, Hands, Bridge)
# Runs Health-Check.ps1 at end.

param(
    [switch]$SkipOptional,
    [int]$ServiceTimeoutSec = 30
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EcosystemFile = Join-Path $Root "ecosystem.config.cjs"

function Write-Stage { param([string]$msg) Write-Host "`n═══ $msg ═══" -ForegroundColor Cyan }
function Write-OK    { param([string]$msg) Write-Host "  [OK ] $msg" -ForegroundColor Green }
function Write-FAIL  { param([string]$msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-INFO  { param([string]$msg) Write-Host "  [    ] $msg" -ForegroundColor Gray }

# ── STAGE A: Environment Validation ──────────────────────────────────────────
Write-Stage "STAGE A — Environment Validation"

$required = @{
    "NEURAL_HANDSHAKE" = $env:NEURAL_HANDSHAKE
    "HF_TOKEN"         = $env:HF_TOKEN
}

$stageAok = $true
foreach ($key in $required.Keys) {
    if ([string]::IsNullOrWhiteSpace($required[$key])) {
        Write-FAIL "Missing env var: $key"
        $stageAok = $false
    } else {
        Write-OK "$key is set (len=$($required[$key].Length))"
    }
}

# Persona file
$personaFile = Join-Path $Root "agentLee.persona.json"
if (Test-Path $personaFile) {
    Write-OK "Persona file found"
} else {
    Write-FAIL "agentLee.persona.json NOT FOUND at $personaFile"
    $stageAok = $false
}

# episodes.db (brain memory) — create empty if missing, don't fail boot
$episodesDb = Join-Path $Root "workspace\episodes.db"
if (-not (Test-Path $episodesDb)) {
    New-Item -ItemType Directory -Path (Split-Path $episodesDb) -Force | Out-Null
    Write-INFO "workspace/episodes.db not found — will be created by brain on first run"
} else {
    Write-OK "episodes.db found"
}

if (-not $stageAok) {
    Write-Host "`n[Appliance-Boot] STAGE A FAILED — aborting." -ForegroundColor Red
    exit 1
}
Write-OK "Stage A complete"

# ── STAGE B: Core PM2 Services ───────────────────────────────────────────────
Write-Stage "STAGE B — Starting Core Services"

$coreServices = @(
    @{ name = "AgentLee-Backend"; healthUrl = "http://localhost:6001/health" },
    @{ name = "AgentLee-Brain";   healthUrl = "http://localhost:6004/health" },
    @{ name = "AgentLee-Tunnel";  healthUrl = $null } # No HTTP health endpoint
)

# Start core services via PM2
try {
    pm2 start $EcosystemFile --only AgentLee-Backend,AgentLee-Brain,AgentLee-Tunnel 2>&1 | Out-Null
} catch {
    Write-FAIL "PM2 start failed: $_"
    exit 1
}

foreach ($svc in $coreServices) {
    if ($null -eq $svc.healthUrl) {
        Write-INFO "$($svc.name) has no HTTP health check — skipping wait"
        continue
    }
    Write-INFO "Waiting for $($svc.name) at $($svc.healthUrl)..."
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $ok = $false
    while ($timer.Elapsed.TotalSeconds -lt $ServiceTimeoutSec) {
        try {
            $resp = Invoke-WebRequest -Uri $svc.healthUrl -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { $ok = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if ($ok) {
        Write-OK "$($svc.name) is healthy ($([int]$timer.Elapsed.TotalSeconds)s)"
    } else {
        Write-FAIL "$($svc.name) did not respond in ${ServiceTimeoutSec}s — continuing anyway"
    }
}

Write-OK "Stage B complete"

# ── STAGE C: Optional Services ───────────────────────────────────────────────
if (-not $SkipOptional) {
    Write-Stage "STAGE C — Starting Optional Services"
    try {
        pm2 start $EcosystemFile --only AgentLee-Frontend,AgentLee-PocketTTS,AgentLee-Hands,AgentLee-MCPBridge 2>&1 | Out-Null
        Write-OK "Optional services started"
    } catch {
        Write-INFO "Optional services start had warnings: $_"
    }
} else {
    Write-Stage "STAGE C — Skipped (--SkipOptional)"
}

# ── Final Health Check ────────────────────────────────────────────────────────
$healthScript = Join-Path $Root "Health-Check.ps1"
if (Test-Path $healthScript) {
    Write-Stage "FINAL — Running Health-Check.ps1"
    & $healthScript
} else {
    Write-INFO "Health-Check.ps1 not found — skipping"
}

Write-Host "`n[Appliance-Boot] Boot sequence complete." -ForegroundColor Green
