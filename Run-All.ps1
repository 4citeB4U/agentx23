# LEEWAY HEADER BLOCK
# File: Run-All.ps1
# Purpose: Agent Lee OS orchestration script
# Security: LEEWAY-CORE-2026 compliant
# Performance: Optimized for sovereign agentic orchestration

param(
    [ValidateSet('start', 'stop', 'restart', 'status', 'verify')]
    [string]$Action = 'restart'
)

$ErrorActionPreference = 'Stop'

# --- Configuration ---
$jupyterVenv = 'C:\Tools\Portable-VSCode-MCP-Kit\.venv'
$jupyterExe  = Join-Path $jupyterVenv 'Scripts\jupyter-lab.exe'
$jupyterArgs = '--ip 127.0.0.1 --port 8888 --no-browser'

# --- Helper Functions ---
function Write-Banner ([string]$Title, [string]$Color = 'Cyan') {
    Write-Host "`n=== $Title ===" -ForegroundColor $Color
}

function Invoke-HttpCheck ([string]$Name, [string]$Url) {
    try {
        # We assign to $null to satisfy PSScriptAnalyzer 'unused variable' warning
        $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        Write-Host "  [OK] $Name ($Url)" -ForegroundColor Green
        return @{ ok = $true; name = $Name; url = $Url }
    } catch {
        Write-Host "  [!!] $Name FAILED: $($_.Exception.Message)" -ForegroundColor Red
        return @{ ok = $false; name = $Name; url = $Url }
    }
}

# --- Core Functions ---
function Start-JupyterLab {
    $running = Get-Process -Name 'jupyter-lab' -ErrorAction SilentlyContinue
    if ($null -eq $running) {
        Write-Host '[INFO] Starting JupyterLab...'
        Start-Process -FilePath $jupyterExe -ArgumentList $jupyterArgs -WindowStyle Hidden
        Start-Sleep -Seconds 5
        Write-Host "[OK] JupyterLab process launched."
    } else {
        Write-Host '[OK] JupyterLab already running.'
    }
}

function Test-AgentLeeStack {
    Write-Banner -Title 'Verifying Agent Lee Stack' -Color 'Cyan'

    # Pull handshake from env
    $handshake = ($env:NEURAL_HANDSHAKE_KEY, $env:NEURAL_HANDSHAKE) | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1
    
    $headers = @{}
    if ($handshake) { $headers['x-neural-handshake'] = $handshake }

    $checks = @()
    # Logic: Only keep the names and URLs we are testing
    $checks += Invoke-HttpCheck -Name 'Frontend (7000)' -Url 'http://127.0.0.1:7000/'
    $checks += Invoke-HttpCheck -Name 'Backend /health (7001)' -Url 'http://127.0.0.1:7001/health'
    $checks += Invoke-HttpCheck -Name 'MCP Bridge /health (7002)' -Url 'http://127.0.0.1:7002/health'
    $checks += Invoke-HttpCheck -Name 'Brain Router /health (7004)' -Url 'http://127.0.0.1:7004/health'
    $checks += Invoke-HttpCheck -Name 'Dashboard MCP (7008)' -Url 'http://127.0.0.1:7008/health'
    $checks += Invoke-HttpCheck -Name 'Browser MCP (7009)' -Url 'http://127.0.0.1:7009/health'

    $failed = $checks | Where-Object { $_.ok -eq $false }
    if ($failed.Count -gt 0) {
        Write-Host "`n[FAIL] Verification failed ($($failed.Count) checks)." -ForegroundColor Red
        return $false
    }

    Write-Host "`n[OK] All core systems responding." -ForegroundColor Green
    return $true
}

# --- Execution Logic ---
switch ($Action) {
    'start' {
        Start-JupyterLab
        # Background Watchdog Job
        Start-Job -ScriptBlock { 
            param($exe, $jupyterArgs)
            while ($true) {
                if (-not (Get-Process -Name 'jupyter-lab' -ErrorAction SilentlyContinue)) {
                    Start-Process -FilePath $exe -ArgumentList $jupyterArgs -WindowStyle Hidden
                }
                Start-Sleep -Seconds 30
            }
        } -ArgumentList $jupyterExe, $jupyterArgs -Name "AgentLee-JupyterWatchdog" | Out-Null
        Test-AgentLeeStack | Out-Null
    }
    'stop' {
        Write-Host "Stopping JupyterLab..."
        Get-Process -Name 'jupyter-lab' -ErrorAction SilentlyContinue | Stop-Process -Force
        Get-Job -Name "AgentLee-JupyterWatchdog" -ErrorAction SilentlyContinue | Remove-Job -Force
    }
    'verify' {
        $null = Test-AgentLeeStack
    }
    'restart' {
        & $MyInvocation.MyCommand.Path -Action stop
        Start-Sleep -Seconds 2
        & $MyInvocation.MyCommand.Path -Action start
    }
    'status' {
        Get-Process -Name 'jupyter-lab' -ErrorAction SilentlyContinue | Select-Object ProcessName, Id, CPU
        Get-Job -Name "AgentLee-JupyterWatchdog" -ErrorAction SilentlyContinue
    }
}