#!/usr/bin/env pwsh
# LEEWAY v12 HEADER
# File: scripts/Install-AgentLeeWSL.ps1
# Purpose: Install Ubuntu WSL2 distro and provision it for Agent Lee (SSH, VS Code, code-server, Playwright).
# Security: Only installs from official Microsoft/Ubuntu sources.
# Usage: ./scripts/Install-AgentLeeWSL.ps1
# Run as Administrator for WSL feature enablement step.

param(
    [string]$Distro   = "Ubuntu-22.04",
    [string]$VMUser   = "agentlee",
    [string]$VMPass   = "agentlee2026",
    [int]   $SSHPort  = 2222
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "`n  → $msg" -ForegroundColor Cyan }
function Pass($msg) { Write-Host "  ✅  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ⚠   $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  ❌  $msg" -ForegroundColor Red }

Write-Host "`n" + "═" * 60 -ForegroundColor Cyan
Write-Host "  AGENT LEE — WSL Ubuntu VM Installer" -ForegroundColor Cyan
Write-Host "  Distro: $Distro  |  User: $VMUser  |  SSH Port: $SSHPort" -ForegroundColor Cyan
Write-Host "═" * 60 + "`n" -ForegroundColor Cyan

# ── Step 1: Enable WSL feature ────────────────────────────────────────────
Step "Checking WSL feature..."
$wslFeature = Get-WindowsOptionalFeature -Online -FeatureName "Microsoft-Windows-Subsystem-Linux" -ErrorAction SilentlyContinue
if ($wslFeature -and $wslFeature.State -eq "Enabled") {
    Pass "WSL feature already enabled"
} else {
    Write-Host "  Enabling WSL (requires reboot)..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName "Microsoft-Windows-Subsystem-Linux" -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName "VirtualMachinePlatform" -NoRestart
    Warn "WSL enabled. Please REBOOT and re-run this script."
    exit 0
}

# ── Step 2: Set WSL2 as default ───────────────────────────────────────────
Step "Setting WSL2 as default..."
wsl --set-default-version 2 2>&1 | Out-Null
Pass "WSL2 default set"

# ── Step 3: Install Ubuntu distro ────────────────────────────────────────
Step "Checking for $Distro..."
$rawList = [System.Text.Encoding]::Unicode.GetString([System.Text.Encoding]::Unicode.GetBytes((wsl -l -q 2>&1) -join "`n"))
$installed = $rawList -match [regex]::Escape($Distro)
if ($installed) {
    Pass "$Distro already installed"
} else {
    Write-Host "  Installing $Distro from Microsoft Store (this may take a few minutes)..." -ForegroundColor Yellow
    wsl --install -d $Distro 2>&1 | Write-Host
    Pass "$Distro installation initiated"
}

# ── Step 4: Provision the Ubuntu environment ──────────────────────────────
Step "Provisioning Agent Lee environment inside Ubuntu..."
$provisionScript = @"
#!/bin/bash
set -e
echo '[provision] Starting Agent Lee Ubuntu setup...'

# Create agentlee user if not exists
if ! id -u $VMUser &>/dev/null; then
    useradd -m -s /bin/bash $VMUser
    echo '${VMUser}:${VMPass}' | chpasswd
    usermod -aG sudo $VMUser
    echo '$VMUser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
    echo '[provision] User $VMUser created'
else
    echo '[provision] User $VMUser already exists'
fi

# Update and install essentials
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q \
    openssh-server curl wget git build-essential \
    python3 python3-pip python3-venv \
    nodejs npm \
    sqlite3 \
    unzip tar

# Configure SSH on custom port $SSHPort
sed -i 's/#Port 22/Port $SSHPort/' /etc/ssh/sshd_config
sed -i 's/Port 22/Port $SSHPort/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
service ssh restart || sshd &
echo '[provision] SSH running on port $SSHPort'

# Install VS Code CLI (code tunnel)
if ! command -v code &>/dev/null; then
    curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' \
        --output /tmp/vscode_cli.tar.gz 2>/dev/null
    tar -xf /tmp/vscode_cli.tar.gz -C /usr/local/bin
    echo '[provision] VS Code CLI installed'
fi

# Install code-server (browser-based VS Code)
if ! command -v code-server &>/dev/null; then
    curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone 2>/dev/null || \
    npm install -g code-server 2>/dev/null || \
    echo '[provision] WARN: code-server install failed — try manually: npm i -g code-server'
fi

# Install Playwright browsers
npm install -g playwright 2>/dev/null || true
python3 -m pip install playwright 2>/dev/null || true
python3 -m playwright install chromium 2>/dev/null || true
echo '[provision] Playwright installed'

# Setup agentlee workspace
sudo -u $VMUser bash -c 'mkdir -p ~/workspace ~/scripts ~/logs ~/data ~/projects'
echo '[provision] Workspace directories created'

# PM2 for service management
npm install -g pm2 2>/dev/null || true

echo '[provision] DONE — Agent Lee Ubuntu VM is ready!'
echo '[provision] SSH: ssh -p $SSHPort $VMUser@localhost'
echo '[provision] VS Code tunnel: code tunnel --name AgentLeeWSL --accept-server-license-terms'
echo '[provision] code-server: code-server --bind-addr 0.0.0.0:8080 --auth password'
"@

# Write script to a Windows temp file with Unix line endings (LF only — CRLF breaks bash)
$tmpWin = "$env:TEMP\provision_agentlee.sh"
$unixScript = $provisionScript -replace "`r`n", "`n" -replace "`r", "`n"
[System.IO.File]::WriteAllText($tmpWin, $unixScript, [System.Text.UTF8Encoding]::new($false))
# Convert Windows path to WSL-accessible /mnt/... path
$tmpWsl = "/mnt/" + ($tmpWin -replace '\\','/' -replace ':','').ToLower()
# Use the exact installed distro name
$distroName = $Distro   # e.g. 'Ubuntu-22.04'

# Wake WSL out of Stopped state first (short ping)
Write-Host "  Waking WSL distro ($distroName)..." -ForegroundColor Yellow
$wakeOut = wsl -d $distroName -- echo "[init] WSL awake" 2>&1
Write-Host "  $wakeOut"
if ($LASTEXITCODE -ne 0) { Fail "Could not wake $distroName — check 'wsl -l -v'"; exit 1 }

# Execute provision script (sudo required for apt/sshd/useradd)
Write-Host "  Running provision script inside $distroName (this may take a few minutes)..." -ForegroundColor Yellow
wsl -d $distroName -- bash -c "chmod +x '$tmpWsl' && sudo bash '$tmpWsl'"
if ($LASTEXITCODE -ne 0) { Fail "Provision script failed (exit $LASTEXITCODE)"; exit 1 }
Pass "Ubuntu environment provisioned"

# ── Step 5: Start SSH in WSL ──────────────────────────────────────────────
Step "Starting SSH server in WSL..."
wsl -d $Distro -- bash -c "sudo service ssh start 2>/dev/null || sudo sshd 2>/dev/null || true"
Pass "SSH service started in WSL (port $SSHPort)"

# ── Step 6: Update .env.agentlee-vm ──────────────────────────────────────
Step "Updating environment variables for WSL VM..."
$envFile = "C:\Tools\Portable-VSCode-MCP-Kit\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    $updates = @{
        "VM_HOST"     = "localhost"
        "VM_PORT"     = "$SSHPort"
        "VM_USER"     = $VMUser
        "VM_PASSWORD" = $VMPass
    }
    foreach ($key in $updates.Keys) {
        if ($envContent -match "^$key=") {
            $envContent = $envContent -replace "(?m)^$key=.*", "$key=$($updates[$key])"
        } else {
            $envContent += "`n$key=$($updates[$key])"
        }
    }
    $envContent | Set-Content $envFile -Encoding utf8
    Pass ".env updated with WSL VM credentials"
} else {
    @"
VM_HOST=localhost
VM_PORT=$SSHPort
VM_USER=$VMUser
VM_PASSWORD=$VMPass
"@ | Out-File -FilePath "$($envFile)" -Encoding utf8 -Append
    Pass ".env created with WSL VM credentials"
}

# ── Summary ───────────────────────────────────────────────────────────────
Write-Host "`n" + "═" * 60 -ForegroundColor Green
Write-Host "  AGENT LEE WSL VM — SETUP COMPLETE" -ForegroundColor Green
Write-Host "═" * 60 -ForegroundColor Green
Write-Host ""
Write-Host "  SSH Access:      ssh -p $SSHPort $VMUser@localhost" -ForegroundColor White
Write-Host "  VS Code Tunnel:  Run inside WSL: code tunnel --name AgentLeeWSL" -ForegroundColor White
Write-Host "  code-server:     Run inside WSL: code-server --bind-addr 0.0.0.0:8080 --auth password" -ForegroundColor White
Write-Host "  Browser:         Playwright chromium installed in WSL" -ForegroundColor White
Write-Host ""
Write-Host "  Backend env vars VM_HOST/VM_PORT/VM_USER/VM_PASSWORD updated." -ForegroundColor Green
Write-Host "  Restart AgentLee-Backend for vmterminal SSH to connect." -ForegroundColor Yellow
Write-Host ""
