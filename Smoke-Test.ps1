# LEEWAY HEADER BLOCK
# File: Smoke-Test.ps1
# Purpose: Agent Lee OS smoke test script
# Security: LEEWAY-CORE-2026 compliant
# Performance: Optimized for sovereign agentic smoke testing
# Discovery: Part of Agent Lee OS test pipeline
# =====================================================================
# LEEWAY_HEADER
# TAG: TOOLS.E2E.SMOKETEST.MAIN
# REGION: 🟢 Full-Stack E2E Smoke Test
# LAYERS:
#   Ports → Security → FileExplorer → Persona → TTS → MCP →
#   DesktopAgent → FileReflection → Brain → GoldenMission → Report
# =====================================================================
#Requires -Version 5.1
$ErrorActionPreference = "SilentlyContinue"

$ROOT  = "C:\Tools\Portable-VSCode-MCP-Kit"
$BRAIN = "http://localhost:6004"
$BACK  = "http://localhost:6001"
$MCP   = "http://localhost:6002"
$DA    = "http://localhost:6005"

# Read handshake from .env.local
$HANDSHAKE = ""
$envFile   = Join-Path $ROOT ".env.local"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^(?:NEURAL_HANDSHAKE|NEURAL_HANDSHAKE_KEY)\s*=\s*(.+)') {
            $HANDSHAKE = $Matches[1].Trim(); break
        }
    }
}
$AUTH_HEADERS = @{ "x-neural-handshake" = $HANDSHAKE; "Content-Type" = "application/json" }

$PASS = 0; $WARN = 0; $FAIL = 0
$REPORT = @{}

function Ok  ($label) { Write-Host "  ✅  $label" -ForegroundColor Green;  $script:PASS++; $script:REPORT[$label]="PASS" }
function Fail ($label,$msg) { Write-Host "  ❌  ${label}: $msg" -ForegroundColor Red;    $script:FAIL++; $script:REPORT[$label]="FAIL: $msg" }
function Warn ($label,$msg) { Write-Host "  ⚠️   ${label}: $msg" -ForegroundColor Yellow; $script:WARN++; $script:REPORT[$label]="WARN: $msg" }

function TcpCheck($port) {
    try {
        $t = [System.Net.Sockets.TcpClient]::new(); $t.Connect("localhost",$port); $t.Close(); return $true
    } catch { return $false }
}

function HttpGet($url) {
    try {
        $r = Invoke-WebRequest -Uri $url -Headers $AUTH_HEADERS -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        return $r.StatusCode
    } catch { return $_.Exception.Response?.StatusCode?.value__ ?? 0 }
}

function HttpGetBody($url) {
    try {
        $r = Invoke-WebRequest -Uri $url -Headers $AUTH_HEADERS -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        return $r.Content
    } catch { return "" }
}

function HttpPost($url,$body) {
    try {
        $r = Invoke-WebRequest -Uri $url -Method POST `
             -Headers $AUTH_HEADERS `
             -Body ($body | ConvertTo-Json -Compress) `
             -ContentType "application/json" `
             -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        return $r.StatusCode
    } catch { return $_.Exception.Response?.StatusCode?.value__ ?? 0 }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Agent Lee — Full Stack Smoke Test                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── § 0 · Port Health ─────────────────────────────────────────────────────
Write-Host "`n[§0] PORT HEALTH" -ForegroundColor Cyan
$PORTS = @(
    @{port=6000;name="Frontend UI"},
    @{port=6001;name="Backend API"},
    @{port=6002;name="MCP Bridge"},
    @{port=6003;name="WS Bridge"},
    @{port=6004;name="Brain Router"},
    @{port=6005;name="Desktop Agent"}
)
$portFail = @()
foreach ($svc in $PORTS) {
    if (TcpCheck $svc.port) { Ok  ":$($svc.port) $($svc.name)" }
    else                    { Fail ":$($svc.port) $($svc.name)" "TCP DOWN"; $portFail += $svc.port }
}
if ($portFail.Count -gt 0) {
    Write-Host "  ⛔  Critical ports down: $($portFail -join ',') — run Run-All.ps1 first" -ForegroundColor Red
}

# ── § 1 · Security Middleware ─────────────────────────────────────────────
Write-Host "`n[§1] SECURITY MIDDLEWARE" -ForegroundColor Cyan

$pub = HttpGet "$BACK/health"
if ($pub -eq 200) { Ok "§1 public /health" } else { Fail "§1 public /health" "Expected 200, got $pub" }

# Unauth request
try {
    $badR = Invoke-WebRequest -Uri "$BACK/api/fs/drives" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $unauth = $badR.StatusCode
} catch { $unauth = $_.Exception.Response?.StatusCode?.value__ ?? 0 }
if ($unauth -in @(401,403)) { Ok "§1 unauth route → $unauth" } else { Fail "§1 unauth route" "Expected 401/403, got $unauth" }

$auth = HttpGet "$BACK/api/fs/drives"
if ($auth -lt 400) { Ok "§1 auth route → $auth" } else { Warn "§1 auth route" "Got $auth" }

# ── § 2 · File Explorer API ───────────────────────────────────────────────
Write-Host "`n[§2] FILE EXPLORER MIRROR" -ForegroundColor Cyan
$drives = HttpGet "$BACK/api/fs/drives"
if ($drives -eq 200) { Ok "§2 /api/fs/drives" } else { Fail "§2 /api/fs/drives" "Status $drives" }
$list = HttpGet "$BACK/api/fs/list?path=$([uri]::EscapeDataString($ROOT))"
if ($list -eq 200) { Ok "§2 /api/fs/list ROOT" } else { Warn "§2 /api/fs/list ROOT" "Status $list" }

# ── § 3 · Persona Smoke (Puppeteer) ──────────────────────────────────────
Write-Host "`n[§3] PERSONA SMOKE TEST" -ForegroundColor Cyan
$verifyScript = Join-Path $ROOT ".Agent_Lee_OS\scripts\verify-ui-persona.mjs"
if (-not (Test-Path $verifyScript)) { $verifyScript = Join-Path $ROOT "scripts\verify-ui-persona.mjs" }
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue)?.Source ?? "node"
if (Test-Path $verifyScript) {
    Write-Host "  Running persona verify (may take 30s)..." -ForegroundColor Gray
    $r = Start-Process -FilePath $nodeExe -ArgumentList @($verifyScript) `
         -WorkingDirectory (Split-Path $verifyScript) `
         -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\persona.out.txt"
    if ($r.ExitCode -eq 0) { Ok "§3 persona verify (exit 0)" }
    else                   { Fail "§3 persona verify" "Exit code $($r.ExitCode)" }
} else { Warn "§3 persona verify" "Script not found" }

# ── § 4 · TTS Endpoint ───────────────────────────────────────────────────
Write-Host "`n[§4] VOICE / TTS" -ForegroundColor Cyan
$tts = HttpPost "$BACK/api/chat/tts" @{ text = "Agent Lee online." }
if ($tts -eq 200) { Ok "§4 POST /api/chat/tts → $tts" }
elseif ($tts -lt 500) { Warn "§4 POST /api/chat/tts" "Got $tts (non-5xx ok)" }
else                  { Fail "§4 POST /api/chat/tts" "Server error $tts" }

# ── § 5 · MCP Bridge ─────────────────────────────────────────────────────
Write-Host "`n[§5] MCP BRIDGE" -ForegroundColor Cyan
$mcpH = HttpGet "$MCP/health"
if ($mcpH -lt 400) { Ok "§5 MCP /health → $mcpH" }
else               { Fail "§5 MCP /health" "Status $mcpH" }

$mcpTools = HttpGetBody "$MCP/tools"
if ($mcpTools) { Ok "§5 MCP /tools returned data" }
else           { Warn "§5 MCP /tools" "Empty or error" }

# ── § 6 · Desktop Agent ──────────────────────────────────────────────────
Write-Host "`n[§6] DESKTOP AGENT" -ForegroundColor Cyan
$daStatus = HttpGet "$DA/status"
if ($daStatus -lt 400) { Ok "§6 Desktop Agent /status → $daStatus" }
else                   { Fail "§6 Desktop Agent /status" "Status $daStatus" }

# ── § 8 · File Reflection (probe) ────────────────────────────────────────
Write-Host "`n[§8] FILE REFLECTION PIPELINE" -ForegroundColor Cyan
$probeName = "e2e_smoke_$([System.DateTime]::UtcNow.Ticks).txt"
$probePath = Join-Path $ROOT "workspace\$probeName"
Set-Content -Path $probePath -Value "E2E smoke probe" -Encoding UTF8
if (Test-Path $probePath) {
    Ok "§8 probe file created"
    $listBody = HttpGetBody "$BACK/api/fs/list?path=$([uri]::EscapeDataString((Split-Path $probePath)))"
    if ($listBody -match [regex]::Escape($probeName)) { Ok "§8 API reflects probe file" }
    else { Warn "§8 API reflects probe" "Not found in listing (may be eventual-consistent)" }
    Remove-Item $probePath -Force
} else { Fail "§8 probe file" "Could not write to workspace/" }

# ── § 9 · Brain Router ───────────────────────────────────────────────────
Write-Host "`n[§9] BRAIN ROUTER" -ForegroundColor Cyan
$brainH = HttpGet "$BRAIN/health"
if ($brainH -eq 200) { Ok "§9 Brain /health → $brainH" } else { Fail "§9 Brain /health" "Status $brainH" }

$brainBody = HttpGetBody "$BRAIN/health"
if ($brainBody -match '"version"\s*:\s*"v4"') { Ok "§9 Brain version=v4" }
else { Warn "§9 Brain version" "Not v4 (body: $($brainBody.Substring(0,[Math]::Min(80,$brainBody.Length))))" }

$currSt = HttpGet "$BRAIN/curriculum/status"
if ($currSt -lt 400) { Ok "§9 /curriculum/status → $currSt" } else { Warn "§9 /curriculum/status" "Status $currSt" }

$retrain = HttpGet "$BRAIN/retrain/status"
if ($retrain -lt 400) { Ok "§9 /retrain/status → $retrain" } else { Warn "§9 /retrain/status" "Status $retrain" }

# ── § 10 · Golden Mission — PacLee files ─────────────────────────────────
Write-Host "`n[§10] GOLDEN MISSION — PACLEE FILES" -ForegroundColor Cyan
$pacDir = Join-Path $ROOT "workspace\preview\paclee"
foreach ($f in @("index.html","game.js","style.css")) {
    $p = Join-Path $pacDir $f
    if (Test-Path $p) { Ok "§10 $f exists ($([System.IO.FileInfo]::new($p).Length) bytes)" }
    else              { Fail "§10 $f" "File missing at $p" }
}
# Verify index.html references game.js
$indexContent = if (Test-Path "$pacDir\index.html") { Get-Content "$pacDir\index.html" -Raw } else { "" }
if ($indexContent -match 'game\.js') { Ok "§10 index.html refs game.js" }
else                                 { Fail "§10 index.html" "Does not reference game.js" }

# ── § 14 · Summary ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SMOKE TEST SUMMARY                                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
foreach ($kv in $REPORT.GetEnumerator()) {
    $ic = if ($kv.Value -eq "PASS") { "✅" } elseif ($kv.Value.StartsWith("WARN")) { "⚠️ " } else { "❌" }
    Write-Host "  $ic $($kv.Key.PadRight(38)) $($kv.Value)"
}
Write-Host ""
Write-Host "  PASS=$PASS  WARN=$WARN  FAIL=$FAIL" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })

# Write JSON report
$reportData = @{
    run_id       = "smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    completed_at = (Get-Date).ToUniversalTime().ToString("o")
    overall      = if ($FAIL -eq 0) { "PASS" } else { "PARTIAL" }
    score        = @{ pass=$PASS; warn=$WARN; fail=$FAIL }
    sections     = $REPORT
}
$reportPath = Join-Path $ROOT "workspace\smoke-report.json"
$reportData | ConvertTo-Json -Depth 5 | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "  📄  Report → $reportPath" -ForegroundColor Gray

if ($FAIL -gt 0) { exit 1 } else { exit 0 }
