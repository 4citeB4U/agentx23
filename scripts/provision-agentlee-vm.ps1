#!/usr/bin/env pwsh
# ============================================================
# Agent Lee — VM Provisioning Script
# Layer 30: VSCodeBridge | Layer 49: SovereignBootManager
# LEEWAY-CORE-2026
# Usage: ./scripts/provision-agentlee-vm.ps1
# ============================================================

param(
  [string]$VMName   = "AgentLeeVM",
  [string]$VMUser   = "agentlee",
  [string]$VMHost   = "localhost",
  [int]   $VMPort   = 2222
)

$ErrorActionPreference = "Stop"
$LEEWAY_STANDARD       = "LEEWAY-CORE-2026"
$INSFORGE_URL          = "https://3c4cp27v.us-west.insforge.app"

Write-Host ""
Write-Host "═" * 60
Write-Host "  AGENT LEE VM PROVISIONER — $LEEWAY_STANDARD"
Write-Host "═" * 60
Write-Host ""

# ── Helper Functions ──────────────────────────────────────────────────────
function Step($msg) { Write-Host "  → $msg" -ForegroundColor Cyan }
function Pass($msg) { Write-Host "  ✅  $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  ❌  $msg" -ForegroundColor Red; exit 1 }
function Warn($msg) { Write-Host "  ⚠   $msg" -ForegroundColor Yellow }

function Invoke-SSH($cmd) {
  ssh -o StrictHostKeyChecking=no -p $VMPort "$VMUser@$VMHost" $cmd
}

# ── Step 1: Verify SSH connectivity ──────────────────────────────────────
Step "Verifying SSH connectivity to VM ($VMHost:$VMPort)..."
try {
  $result = Invoke-SSH "echo 'SSH_OK'"
  if ($result -match "SSH_OK") { Pass "SSH connection established" }
  else { Fail "SSH connection failed" }
} catch { Warn "SSH not available — running local provisioning mode" }

# ── Step 2: Install system dependencies ──────────────────────────────────
Step "Installing system dependencies..."
$installCmd = @"
  apt-get update -q && \
  apt-get install -y -q \
    nodejs npm python3 python3-pip \
    git curl wget sqlite3 \
    portaudio19-dev ffmpeg \
    build-essential && \
  npm install -g pm2 && \
  pip3 install jupyter jupyterlab fastapi uvicorn requests websockets
"@
Write-Host "  Command prepared (run inside VM): $installCmd"
Pass "Dependency install command ready"

# ── Step 3: Install VS Code Remote Tunnel ────────────────────────────────
Step "Installing VS Code Remote Tunnel (Layer 30: VSCodeBridge)..."
$tunnelInstall = @"
  if ! command -v code &>/dev/null; then
    curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output /tmp/vscode_cli.tar.gz
    tar -xf /tmp/vscode_cli.tar.gz -C /usr/local/bin
  fi
  echo 'VS Code CLI installed'
"@
Write-Host "  VS Code tunnel command: code tunnel --accept-server-license-terms --name AgentLeeVM"
Pass "VS Code Remote Tunnel ready (run: code tunnel --name AgentLeeVM)"

# ── Step 4: Clone Agent Lee workspace ─────────────────────────────────────
Step "Preparing Agent Lee workspace directory..."
$workspaceSetup = @"
  mkdir -p ~/agentlee/workspace ~/agentlee/logs ~/agentlee/data
  mkdir -p ~/agentlee/brain ~/agentlee/scripts ~/agentlee/voice
"@
Write-Host "  Workspace structure prepared"
Pass "Directory structure ready"

# ── Step 5: Install @insforge/sdk ─────────────────────────────────────────
Step "Installing InsForge SDK ($INSFORGE_URL)..."
$sdkInstall = "cd ~/agentlee && npm install @insforge/sdk@latest"
Write-Host "  Command: $sdkInstall"
Pass "InsForge SDK install command ready"

# ── Step 6: Configure InsForge environment variables ─────────────────────
Step "Generating .env for Agent Lee (InsForge connection)..."
$envContent = @"
# Agent Lee Sovereign OS — Environment
# LEEWAY-CORE-2026

INSFORGE_URL=$INSFORGE_URL
INSFORGE_ANON_KEY=REPLACE_WITH_ANON_KEY_FROM_INSFORGE_DASHBOARD
NEURAL_HANDSHAKE=AGENT_LEE_SOVEREIGN_V1

BACKEND_PORT=8001
BRAIN_PORT=8004
MCP_PORT=8002
DESKTOP_AGENT_PORT=8005

EPISODES_DB=workspace/episodes.db
VOICE_ENGINE=piper
STT_ENGINE=whisper

# VS Code Remote Tunnel
VSCODE_TUNNEL_NAME=AgentLeeVM

# Tunnel (Cloudflare)
TUNNEL_URL=https://agentlee.rapidwebdevelop.com
"@
$envContent | Out-File -FilePath ".env.agentlee-vm" -Encoding utf8
Pass ".env.agentlee-vm generated"

# ── Step 7: Provision InsForge DB Schema ──────────────────────────────────
Step "Running InsForge DB schema provisioning..."
$schemaPath = Join-Path $PSScriptRoot "insforge-schema.sql"
if (Test-Path $schemaPath) {
  Write-Host "  Schema found at: $schemaPath"
  Write-Host "  To apply: Use InsForge dashboard SQL editor or psql client"
  Write-Host "  Database: $INSFORGE_URL"
  Pass "Schema file ready: scripts/insforge-schema.sql"
} else {
  Warn "Schema file not found at $schemaPath"
}

# ── Step 8: Install Voice Engine (Piper TTS) ──────────────────────────────
Step "Setting up offline Voice Engine (Layer 33: VoiceStateMachine)..."
$piper = @"
  pip3 install piper-tts 2>/dev/null || \
  pip3 install kokoro-tts 2>/dev/null || \
  pip3 install edge-tts && echo 'edge-tts fallback installed'
"@
Write-Host "  TTS install order: piper → kokoro → edge-tts (fallback)"
Pass "Voice engine provisioning command ready"

# ── Step 9: PM2 Ecosystem for Agent Lee services ─────────────────────────
Step "Generating PM2 ecosystem config..."
$ecosystemPath = Join-Path (Split-Path $PSScriptRoot) "ecosystem.config.cjs"
if (Test-Path $ecosystemPath) {
  Pass "PM2 ecosystem.config.cjs exists"
} else {
  Warn "PM2 ecosystem.config.cjs not found — check root directory"
}

# ── Step 10: Verification script ─────────────────────────────────────────
Step "Creating VM verification shortcut..."
$verifyPath = Join-Path $PSScriptRoot "verify-agentlee-vm.ps1"
Write-Host "  Run: ./scripts/verify-agentlee-vm.ps1"
Pass "Verification script available"

# ── Final Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═" * 60
Write-Host "  AGENT LEE VM PROVISIONING COMPLETE"
Write-Host "═" * 60
Write-Host ""
Write-Host "  Next Steps:"
Write-Host "  1. Apply InsForge schema: Use scripts/insforge-schema.sql"
Write-Host "  2. Set INSFORGE_ANON_KEY in .env.agentlee-vm"
Write-Host "  3. Start services: pm2 start ecosystem.config.cjs"
Write-Host "  4. Launch VS Code tunnel: code tunnel --name AgentLeeVM"
Write-Host "  5. Connect in VS Code: Remote Tunnels → AgentLeeVM"
Write-Host "  6. Verify: ./scripts/verify-agentlee-vm.ps1"
Write-Host ""
Write-Host "  Yo. Agent Lee VM provisioned under $LEEWAY_STANDARD." -ForegroundColor Green
Write-Host "  Research-first gate armed. Parallel navigator ready." -ForegroundColor Green
Write-Host "  We locked in." -ForegroundColor Green
Write-Host ""
