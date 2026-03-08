# Agent Lee OS -- Hybrid Health Check
# TCP + HTTP + MCP Bridge + InsForge + AI Status + Tunnel + Memory Lake
# Usage: .\Health-Check.ps1

$ErrorActionPreference = "SilentlyContinue"

# -- Config -------------------------------------------------------------------
if ($env:NEURAL_HANDSHAKE)         { $HW = $env:NEURAL_HANDSHAKE }
elseif ($env:NEURAL_HANDSHAKE_KEY) { $HW = $env:NEURAL_HANDSHAKE_KEY }
else                               { $HW = "AGENT_LEE_SOVEREIGN_V1" }
$HEADERS = @{ "x-neural-handshake" = $HW }

# -- Helpers ------------------------------------------------------------------
function Write-Section([string]$title) {
    Write-Host ""
    Write-Host ("  [ $title ]") -ForegroundColor Cyan
    Write-Host ("  " + ("-" * 54)) -ForegroundColor DarkGray
}

function Test-TCP([int]$port) {
    # -InformationLevel Quiet returns a bare bool in PS 5.1
    return (Test-NetConnection -ComputerName 127.0.0.1 -Port $port `
            -WarningAction SilentlyContinue -InformationLevel Quiet)
}

function Test-HTTP([string]$url, [bool]$auth = $false, [int]$secs = 5) {
    try {
        $h = if ($auth) { $HEADERS } else { @{} }
        $r = Invoke-WebRequest -Uri $url -Headers $h -TimeoutSec $secs -UseBasicParsing
        $b = if ($r.Content) { $r.Content.ToString() } else { "" }
        return @{ OK = $true;  Code = $r.StatusCode; Snippet = $b.Substring(0, [Math]::Min(70, $b.Length)) }
    } catch {
        $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
        $msg  = $_.Exception.Message
        return @{ OK = $false; Code = $code; Snippet = $msg.Substring(0, [Math]::Min(58, $msg.Length)) }
    }
}

function Write-Row([string]$name, [bool]$tcp, $http) {
    $t   = if ($tcp)     { "TCP[OK]" } else { "TCP[--]" }
    $h   = if ($http.OK) { "HTTP[$($http.Code)]" } else { "HTTP[!!]" }
    $col = if ($tcp -and $http.OK) { "Green" } elseif ($tcp) { "Yellow" } else { "Red" }
    $pad = " " * [Math]::Max(1, 28 - $name.Length)
    Write-Host ("  $t  $h  $name" + $pad + $http.Snippet) -ForegroundColor $col
}

# =============================================================================
Write-Host ""
Write-Host "  Agent Lee OS -- Health Check  $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White
Write-Host ("  " + ("=" * 54)) -ForegroundColor DarkGray

# -- SECTION 1: Core Services -------------------------------------------------
Write-Section "CORE SERVICES"

$core = @(
    @{ Port = 6001; Name = "Backend API";   URL = "http://localhost:6001/health"; Auth = $true  },
    @{ Port = 6002; Name = "MCP Bridge";    URL = "http://localhost:6002/health"; Auth = $false },
    @{ Port = 6003; Name = "WebSocket";     URL = "http://localhost:6003";        Auth = $false; WsOnly = $true },
    @{ Port = 6004; Name = "Neural Router"; URL = "http://localhost:6004/health"; Auth = $false },
    @{ Port = 6005; Name = "Desktop Agent"; URL = "http://localhost:6005/status"; Auth = $false },
    @{ Port = 6000; Name = "Frontend UI";   URL = "http://localhost:6000";        Auth = $false }
)

$coreOk = 0
foreach ($s in $core) {
    $tcp  = Test-TCP $s.Port
    $http = if ($tcp) { Test-HTTP $s.URL $s.Auth } else { @{ OK = $false; Code = 0; Snippet = "not running" } }
    # WebSocket ports return HTTP 426 Upgrade Required -- that IS healthy
    $wsOk = $s.WsOnly -and $tcp -and ($http.Code -eq 426 -or $http.Code -eq 400)
    if ($wsOk) { $http = @{ OK = $true; Code = $http.Code; Snippet = "WS ready (426 Upgrade Required)" } }
    Write-Row $s.Name $tcp $http
    if ($tcp -and $http.OK) { $coreOk++ }
}
Write-Host ""
Write-Host ("  $coreOk/$($core.Count) core services healthy") `
    -ForegroundColor $(if ($coreOk -eq $core.Count) { "Green" } else { "Yellow" })

# -- SECTION 2: MCP Bridge + Tools --------------------------------------------
Write-Section "MCP BRIDGE + TOOLS  (port 6002)"

$bridgeTcp  = Test-TCP 6002
$bridgeHttp = Test-HTTP "http://localhost:6002/health" $false
Write-Row "MCP Bridge" $bridgeTcp $bridgeHttp

if (-not $bridgeTcp) {
    Write-Host "  !! Bridge offline -- start: node vscode-mcp-tooling/src/bridge.js" -ForegroundColor Red
} else {
    try {
        $bstatus = Invoke-RestMethod "http://localhost:8002/status" -TimeoutSec 5
        $modules = if ($bstatus.modules) { $bstatus.modules } else { $null }
        $toolOk  = 0
        foreach ($t in @("testsprite", "playwright", "insforge", "stitch")) {
            $m    = if ($modules) { $modules.$t } else { $null }
            $up   = $m -and ($m.status -eq "running" -or $m.running -eq $true)
            $pid_ = if ($m -and $m.pid) { "pid=$($m.pid)" } else { "stopped" }
            $icon = if ($up) { "UP  " } else { "DOWN" }
            $col  = if ($up) { "Green" } else { "Yellow" }
            Write-Host ("    [$icon]  $t  ($pid_)") -ForegroundColor $col
            if ($up) { $toolOk++ }
        }
        Write-Host ""
        Write-Host ("  $toolOk/4 MCP tools running") `
            -ForegroundColor $(if ($toolOk -eq 4) { "Green" } else { "Yellow" })
    } catch {
        Write-Host "  !! Could not read /status from bridge" -ForegroundColor Yellow
    }
}

# -- SECTION 3: InsForge ------------------------------------------------------
Write-Section "INSFORGE"

$extPath = Join-Path $PSScriptRoot "extensions\insforge.insforge-0.0.8_20260213_191000"
$extOk   = Test-Path $extPath
$extLabel = if ($extOk) { "[INSTALLED]  InsForge v0.0.8 (local extension)" } `
                        else { "[MISSING]    InsForge extension not found" }
Write-Host ("  " + $extLabel) -ForegroundColor $(if ($extOk) { "Green" } else { "Red" })

    $insApi = Test-HTTP "http://localhost:6001/api/mcp/status" $true 4
$insCol = if ($insApi.OK) { "Green" } else { "Yellow" }
Write-Host ("  [API]  /api/mcp/status  HTTP $($insApi.Code)  " + $insApi.Snippet) -ForegroundColor $insCol

# -- SECTION 4: Neural Router AI Status ---------------------------------------
Write-Section "NEURAL ROUTER -- AI STATUS  (port 6004)"

try {
    $ai = Invoke-RestMethod "http://localhost:6004/ai-status" -TimeoutSec 6
    Write-Host ("  Base model     : " + $ai.base_model)                                     -ForegroundColor White
    $ad = if ($ai.active_adapter -and $ai.active_adapter -ne '') { $ai.active_adapter } else { "none (base weights)" }
    Write-Host ("  Active adapter : " + $ad)                                                 -ForegroundColor White
    Write-Host ("  Voice state    : " + $ai.voice_state)                                     -ForegroundColor White
    Write-Host ("  Episodes today : " + $ai.episodes_today)                                  -ForegroundColor White
    Write-Host ("  Episodes total : " + $ai.episodes_total)                                  -ForegroundColor White
    Write-Host ("  Synthetic data : " + $ai.synthetic_generated + " records")                -ForegroundColor White
    $dnsCol = if ($ai.dns_resolved) { "Green" } else { "Yellow" }
    Write-Host ("  DNS resolved   : " + $ai.dns_resolved)                                    -ForegroundColor $dnsCol
} catch {
    Write-Host "  !! /ai-status unreachable -- is server.py running on 6004?" -ForegroundColor Yellow
}

# -- SECTION 5: Tunnel --------------------------------------------------------
Write-Section "TUNNEL STATUS"

try {
    $t    = Invoke-RestMethod "http://localhost:6001/api/tunnel/status" -Headers $HEADERS -TimeoutSec 5
    $tCol = if ($t.running) { "Green" } else { "Red" }
    $tProvider = if ($t.provider) { $t.provider } else { "--" }
    $tUrl     = if ($t.url)      { $t.url }      else { "none" }
    Write-Host ("  Running  : " + $t.running)    -ForegroundColor $tCol
    Write-Host ("  Provider : " + $tProvider)    -ForegroundColor White
    Write-Host ("  URL      : " + $tUrl)         -ForegroundColor Cyan
} catch {
    # Fallback: scan cloudflared log for last live URL
    $cfLog = Join-Path $PSScriptRoot "workspace\cloudflared.log"
    if (Test-Path $cfLog) {
        $hit = Select-String -Path $cfLog -Pattern "trycloudflare\.com|ngrok-free\.dev|ngrok\.app" `
               | Select-Object -Last 1
        if ($hit) {
            Write-Host ("  [LOG] " + $hit.Line.Trim()) -ForegroundColor Cyan
        } else {
            Write-Host "  !! No active tunnel URL found in log" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  !! Tunnel endpoint unreachable and no log file found" -ForegroundColor Yellow
    }
}

# -- SECTION 6: Memory Lake + Data Files --------------------------------------
Write-Section "MEMORY LAKE + DATA"

$dataFiles = @(
    @{ Path = "workspace\memory.json";                     Label = "Memory Lake (memory.json)"  },
    @{ Path = "workspace\adapters.json";                   Label = "Adapter Registry"           },
    @{ Path = "workspace\episodes.db";                     Label = "Episode DB (SQLite)"        },
    @{ Path = "workspace\synthetic.jsonl";                 Label = "Synthetic Training Data"    },
    @{ Path = "workspace\knowledge_base\project_bible.md"; Label = "Project Bible"             }
)

foreach ($d in $dataFiles) {
    $exists = Test-Path (Join-Path $PSScriptRoot $d.Path)
    $icon   = if ($exists) { "[OK]" } else { "[--]" }
    $col    = if ($exists) { "Green" } else { "DarkGray" }
    Write-Host ("  $icon  " + $d.Label) -ForegroundColor $col
}

# -- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host ("  " + ("=" * 54)) -ForegroundColor DarkGray
Write-Host "  Quick commands:" -ForegroundColor DarkGray
Write-Host "    Start all  : .\Run-All.ps1 restart" -ForegroundColor DarkGray
Write-Host "    MCP bridge : node vscode-mcp-tooling\src\bridge.js" -ForegroundColor DarkGray
Write-Host "    Brain      : .venv\Scripts\python.exe server.py" -ForegroundColor DarkGray
Write-Host "    Tunnel     : node scripts\validateTunnel.js --watch" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Health check complete." -ForegroundColor Yellow
