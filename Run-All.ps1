param(
    [ValidateSet('start', 'stop', 'restart', 'status', 'verify')]
    [string]$Action = 'restart'
)

$ErrorActionPreference = 'Stop'
$root = 'C:\Tools\Portable-VSCode-MCP-Kit'
$ecosystem = Join-Path $root 'ecosystem.config.cjs'
$ports = @(8000, 8001, 8002, 8003, 8004, 8005, 4040, 8015)

function Write-Banner {
    param(
        [string]$Title,
        [string]$Color = 'Cyan'
    )

    Write-Host '=======================================================' -ForegroundColor $Color
    Write-Host "   $Title" -ForegroundColor $Color
    Write-Host '=======================================================' -ForegroundColor $Color
}

function Import-EnvironmentSettings {
    $envPath = Join-Path $root '.env.local'
    if (-not (Test-Path $envPath)) {
        return
    }

    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
        }
    }

    Write-Host '[OK] Environment variables loaded from .env.local' -ForegroundColor Green
}

function Invoke-HttpCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url,
        [string]$ExpectContains,
        [switch]$Json,
        [hashtable]$Headers = @{}
    )

    try {
        if ($Json) {
            $result = Invoke-RestMethod -Method Get -Uri $Url -Headers $Headers -TimeoutSec 6
            Write-Host "  [OK] $Name" -ForegroundColor Green
            return @{ ok = $true; name = $Name; url = $Url; result = $result }
        }

        $resp = Invoke-WebRequest -Method Get -Uri $Url -Headers $Headers -TimeoutSec 6 -UseBasicParsing
        $content = [string]$resp.Content
        if ($ExpectContains -and ($content -notmatch [regex]::Escape($ExpectContains))) {
            Write-Host "  [!!] $Name (missing expected text: $ExpectContains)" -ForegroundColor Red
            return @{ ok = $false; name = $Name; url = $Url; error = 'MISSING_EXPECTED_TEXT' }
        }

        Write-Host "  [OK] $Name" -ForegroundColor Green
        return @{ ok = $true; name = $Name; url = $Url }
    }
    catch {
        Write-Host "  [!!] $Name ($($_.Exception.Message))" -ForegroundColor Red
        return @{ ok = $false; name = $Name; url = $Url; error = $_.Exception.Message }
    }
}

function Verify-AgentLeeStack {
    Write-Banner -Title 'Verifying Agent Lee Stack' -Color 'Cyan'

    Import-EnvironmentSettings

    $handshake = ($env:NEURAL_HANDSHAKE_KEY, $env:NEURAL_HANDSHAKE | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
    $headers = @{}
    if ($handshake) {
        $headers['x-neural-handshake'] = $handshake
    }

    $checks = @()

    # Frontend (Vite)
    $checks += Invoke-HttpCheck -Name 'Frontend (8000)' -Url 'http://127.0.0.1:8000/' -ExpectContains 'Agent Lee'

    # Backend health
    $checks += Invoke-HttpCheck -Name 'Backend /health (8001)' -Url 'http://127.0.0.1:8001/health' -Json

    # MCP Bridge health
    $checks += Invoke-HttpCheck -Name 'MCP Bridge /health (8002)' -Url 'http://127.0.0.1:8002/health' -Json

    # Brain Router health
    $checks += Invoke-HttpCheck -Name 'Brain Router /health (8004)' -Url 'http://127.0.0.1:8004/health' -Json

    # Desktop agent status
    $checks += Invoke-HttpCheck -Name 'Desktop Agent /status (8005)' -Url 'http://127.0.0.1:8005/status' -Json

    # Screenshot route (handshake-protected). Proves LIVE pipeline is functional.
    if ($headers.Count -gt 0) {
        try {
            $s = Invoke-WebRequest -Method Get -Uri "http://127.0.0.1:8001/api/device/screenshot?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -Headers $headers -TimeoutSec 8 -UseBasicParsing
            $ct = [string]$s.Headers['Content-Type']
            if ($s.StatusCode -ge 200 -and $s.StatusCode -lt 300 -and $ct -match 'image/') {
                Write-Host '  [OK] Backend /api/device/screenshot (handshake)' -ForegroundColor Green
            } else {
                Write-Host "  [!!] Backend /api/device/screenshot unexpected (HTTP $($s.StatusCode), CT=$ct)" -ForegroundColor Red
                $checks += @{ ok = $false; name = 'Backend /api/device/screenshot'; url = 'http://127.0.0.1:8001/api/device/screenshot'; error = 'UNEXPECTED_RESPONSE' }
            }
        }
        catch {
            Write-Host "  [!!] Backend /api/device/screenshot (handshake) ($($_.Exception.Message))" -ForegroundColor Red
            $checks += @{ ok = $false; name = 'Backend /api/device/screenshot'; url = 'http://127.0.0.1:8001/api/device/screenshot'; error = $_.Exception.Message }
        }
    }

    # Chat route (handshake-protected)
    if ($headers.Count -gt 0) {
        try {
            $chatResponse = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8001/api/chat' -Headers $headers -ContentType 'application/json' -TimeoutSec 8 -Body (ConvertTo-Json @{ text = 'hello'; source = 'web'; id = "verify-$(Get-Random)" })
            if ($chatResponse -and $chatResponse.text) {
                Write-Host '  [OK] Backend /api/chat (handshake)' -ForegroundColor Green
            } else {
                Write-Host '  [!!] Backend /api/chat (handshake) returned no text' -ForegroundColor Red
                $checks += @{ ok = $false; name = 'Backend /api/chat'; url = 'http://127.0.0.1:8001/api/chat'; error = 'NO_TEXT' }
            }
        }
        catch {
            Write-Host "  [!!] Backend /api/chat (handshake) ($($_.Exception.Message))" -ForegroundColor Red
            $checks += @{ ok = $false; name = 'Backend /api/chat'; url = 'http://127.0.0.1:8001/api/chat'; error = $_.Exception.Message }
        }
    } else {
        Write-Host '  [WARN] Skipping /api/chat verification (missing NEURAL_HANDSHAKE_KEY).' -ForegroundColor Yellow
    }

    $failed = $checks | Where-Object { $_ -and $_.ok -eq $false }
    if ($failed.Count -gt 0) {
        Write-Host ''
        Write-Host "[FAIL] Verification failed ($($failed.Count) checks)." -ForegroundColor Red
        foreach ($f in $failed) {
            Write-Host "  - $($f.name): $($f.url)" -ForegroundColor Red
        }
        return $false
    }

    Write-Host ''
    Write-Host '[OK] Verification passed.' -ForegroundColor Green
    return $true
}

function Get-Pm2Executable {
    $localPm2 = Join-Path $root 'node_modules\.bin\pm2.cmd'
    if (Test-Path $localPm2) { return $localPm2 }

    $pm2Cmd = Get-Command pm2 -ErrorAction SilentlyContinue
    if ($pm2Cmd) { return 'pm2' }

    Write-Host '[WARN] PM2 not found. Installing local dependency...' -ForegroundColor Yellow
    Push-Location $root
    try {
        npm install pm2 --no-save | Out-Null
    }
    finally {
        Pop-Location
    }

    if (Test-Path $localPm2) { return $localPm2 }
    throw 'PM2 installation failed.'
}

function Stop-ProcessesByPort {
    param([int[]]$PortList)

    foreach ($port in $PortList) {
        $netLines = netstat -ano | Select-String ":$port"
        if (-not $netLines) { continue }

        $processNumbers = $netLines | ForEach-Object {
            $parts = ($_ -split '\s+') | Where-Object { $_ -ne '' }
            if ($parts.Count -gt 0) { $parts[-1] }
        } | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique

        foreach ($processNumber in $processNumbers) {
            try {
                Stop-Process -Id ([int]$processNumber) -Force -ErrorAction Stop
                Write-Host "  [OK] Stopped process $processNumber (port $port)" -ForegroundColor DarkGray
            }
            catch {
                # best effort
            }
        }
    }
}

function Start-NgrokTunnel {
    $ngrokExe = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $ngrokExe) {
        Write-Host '[WARN] ngrok not found, skipping tunnel startup.' -ForegroundColor Yellow
        return
    }

    $ngrokRunning = netstat -ano | Select-String ':4040'
    if ($ngrokRunning) {
        Write-Host '[INFO] ngrok already active on port 4040' -ForegroundColor DarkGray
        return
    }

    Write-Host '[INFO] Starting ngrok tunnel on port 8000...' -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList @(
        '-NoExit',
        '-Command',
        "Set-Location '$root'; ngrok http 8000"
    ) | Out-Null

    Start-Sleep -Seconds 2
}

function Show-StackStatus {
    param([string]$Pm2)

    Write-Banner -Title 'Agent Lee Stack Status' -Color 'Yellow'

    Push-Location $root
    try {
        & $Pm2 list
    }
    finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host 'Port checks:' -ForegroundColor Yellow
    foreach ($port in $ports) {
        $testResult = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
        if ($testResult.TcpTestSucceeded) {
            Write-Host "  [OK] $port" -ForegroundColor Green
        }
        else {
            Write-Host "  [--] $port" -ForegroundColor DarkGray
        }
    }

    Write-Host ''
    Write-Host 'Access:' -ForegroundColor Yellow
    Write-Host '  Frontend:    http://localhost:8000'
    Write-Host '  Backend:     http://localhost:8001/health'
    Write-Host '  MCP Bridge:  http://localhost:8002'
    Write-Host '  Neural:      http://localhost:8004/health'
    Write-Host '  Desktop:     http://localhost:8005/status'
    Write-Host '  ngrok UI:    http://localhost:4040'
}

function Stop-AgentLeeStack {
    param([string]$Pm2)

    Write-Banner -Title 'Stopping Agent Lee Stack' -Color 'Magenta'

    Push-Location $root
    try {
        try { & $Pm2 delete all | Out-Null } catch {}
        try { & $Pm2 save | Out-Null } catch {}
    }
    finally {
        Pop-Location
    }

    Stop-ProcessesByPort -PortList $ports

    Write-Host '[OK] Stack stop sequence complete.' -ForegroundColor Green
}

function Start-AgentLeeStack {
    param([string]$Pm2)

    Write-Banner -Title 'Starting Agent Lee Stack' -Color 'Cyan'

    if (-not (Test-Path $ecosystem)) {
        throw "Missing ecosystem file: $ecosystem"
    }

    Import-EnvironmentSettings

    Push-Location $root
    try {
        & $Pm2 start $ecosystem
        & $Pm2 save | Out-Null
    }
    finally {
        Pop-Location
    }

    Start-NgrokTunnel

    Write-Host ''
    Write-Host '[OK] Stack startup issued.' -ForegroundColor Green
}

$pm2 = Get-Pm2Executable

switch ($Action) {
    'stop' {
        Stop-AgentLeeStack -Pm2 $pm2
        Show-StackStatus -Pm2 $pm2
    }
    'start' {
        Start-AgentLeeStack -Pm2 $pm2
        Show-StackStatus -Pm2 $pm2
        [void](Verify-AgentLeeStack)
    }
    'restart' {
        Stop-AgentLeeStack -Pm2 $pm2
        Start-Sleep -Seconds 1
        Start-AgentLeeStack -Pm2 $pm2
        Show-StackStatus -Pm2 $pm2
        [void](Verify-AgentLeeStack)
    }
    'status' {
        Show-StackStatus -Pm2 $pm2
    }
    'verify' {
        $ok = Verify-AgentLeeStack
        if (-not $ok) { exit 1 }
    }
}
