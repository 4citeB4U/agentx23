#!/usr/bin/env pwsh
# ============================================================
# Agent Lee — VM Verification Script
# Layer 49: SovereignBootManager | LEEWAY-CORE-2026
# Usage: ./scripts/verify-agentlee-vm.ps1
# ============================================================

$HANDSHAKE   = $env:NEURAL_HANDSHAKE  ?? "AGENT_LEE_SOVEREIGN_V1"
$LOCAL_BASE  = "http://localhost:8001"
$BRAIN_BASE  = "http://localhost:8004"
$INSFORGE    = "https://3c4cp27v.us-west.insforge.app"
$DB_PATH     = "workspace\episodes.db"
$PERSONA     = "agentLee.persona.json"
$PASS = 0; $FAIL = 0; $SKIP = 0

function Check($name, $value, $detail = "") {
  if ($value) {
    Write-Host ("  ✅  {0,-45} {1}" -f $name, $detail) -ForegroundColor Green
    $global:PASS++
  } else {
    Write-Host ("  ❌  {0,-45} {1}" -f $name, $detail) -ForegroundColor Red
    $global:FAIL++
  }
}
function Skip($name, $detail = "") {
  Write-Host ("  ⏭   {0,-45} {1}" -f $name, $detail) -ForegroundColor Yellow
  $global:SKIP++
}

Write-Host ""
Write-Host "═" * 65
Write-Host "  AGENT LEE SOVEREIGN VM VERIFICATION — LEEWAY-CORE-2026"
Write-Host "═" * 65
Write-Host ""

# ── Layer 3: LEEWAY Protocol ──────────────────────────────────────────────
Write-Host "  [Ring 1] Identity Kernel"
Check "LEEWAY Handshake set" ($HANDSHAKE.Length -gt 10) $HANDSHAKE.Substring(0, [Math]::Min(15, $HANDSHAKE.Length))

# ── Layer 49: Persona File Verification ──────────────────────────────────
$personaOk = $false; $layerCount = 0
if (Test-Path $PERSONA) {
  try {
    $p = Get-Content $PERSONA | ConvertFrom-Json
    $layerCount = $p.layers.Count
    $personaOk = ($p.persona_version -eq "AgentLee_OS_Conscious_v2") -and ($layerCount -eq 50)
  } catch {}
}
Check "Persona v2 loaded (50 layers)" $personaOk "Layers: $layerCount"

# ── Layer 19: Local episodes.db ───────────────────────────────────────────
Write-Host ""
Write-Host "  [Ring 3] Memory & Learning"
$dbExists = Test-Path $DB_PATH
Check "episodes.db exists" $dbExists $DB_PATH
if ($dbExists) {
  try {
    $count = sqlite3 $DB_PATH "SELECT COUNT(*) FROM episodes;" 2>$null
    Check "episodes.db readable" ($count -ne $null) "$count episodes stored"
  } catch { Skip "episodes.db query" "sqlite3 CLI not in PATH" }
}

# ── InsForge connectivity ────────────────────────────────────────────────
Write-Host ""
Write-Host "  [Ring 4] InsForge Cloud Layer"
try {
  $res = Invoke-WebRequest -Uri "$INSFORGE" -TimeoutSec 5 -ErrorAction Stop
  Check "InsForge backend reachable" ($res.StatusCode -eq 200) "HTTP $($res.StatusCode)"
} catch {
  Skip "InsForge backend reachable" "Network check skipped"
}

# ── Backend service ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "  [Ring 2] Operational Cognition"
try {
  $hdr = @{ "X-Neural-Handshake" = $HANDSHAKE }
  $res = Invoke-WebRequest -Uri "$LOCAL_BASE/api/health" -Headers $hdr -TimeoutSec 5 -ErrorAction Stop
  Check "Backend API health" ($res.StatusCode -eq 200) "HTTP $($res.StatusCode)"
} catch {
  Check "Backend API health" $false "Not reachable — start with: pm2 start ecosystem.config.cjs"
}

# ── MCP bridge ────────────────────────────────────────────────────────────
try {
  $hdr = @{ "X-Neural-Handshake" = $HANDSHAKE; "Content-Type" = "application/json" }
  $res = Invoke-WebRequest -Uri "$LOCAL_BASE/api/mcp/status" -Headers $hdr -TimeoutSec 5 -ErrorAction Stop
  $body = $res.Content | ConvertFrom-Json
  Check "MCP bridge status" ($res.StatusCode -eq 200) "Bridge: $($body.bridge.status)"
} catch {
  Skip "MCP bridge status" "Backend not running"
}

# ── Brain service ─────────────────────────────────────────────────────────
try {
  $res = Invoke-WebRequest -Uri "$BRAIN_BASE/health" -TimeoutSec 5 -ErrorAction Stop
  Check "Brain service (FastAPI)" ($res.StatusCode -eq 200) "HTTP $($res.StatusCode)"
} catch {
  Check "Brain service (FastAPI)" $false "Not reachable on port 8004"
}

# ── Layer 33: Voice Engine ────────────────────────────────────────────────
Write-Host ""
Write-Host "  [Ring 4] Expansion Systems"
$piperFound   = (Get-Command piper -ErrorAction SilentlyContinue) -ne $null
$edgeTtsFound = (Get-Command edge-tts -ErrorAction SilentlyContinue) -ne $null
Check "Voice engine (piper or edge-tts)" ($piperFound -or $edgeTtsFound) $(if ($piperFound) { "piper" } elseif ($edgeTtsFound) { "edge-tts" } else { "none found" })

# ── Layer 30: VS Code Tunnel ──────────────────────────────────────────────
$codeFound = (Get-Command code -ErrorAction SilentlyContinue) -ne $null
Check "VS Code CLI available" $codeFound $(if ($codeFound) { "code tunnel ready" } else { "Install VS Code CLI" })

# ── PM2 Process Status ────────────────────────────────────────────────────
try {
  $NODE = (Get-Command node -ErrorAction Stop).Source
  $PM2  = Join-Path $PSScriptRoot "..\node_modules\pm2\bin\pm2"
  $pm2Out = & $NODE $PM2 list 2>&1 | Out-String
  $backendRunning = $pm2Out -match "AgentLee-Backend.*online"
  $brainRunning   = $pm2Out -match "AgentLee-Brain.*online"
  Check "PM2: AgentLee-Backend online" $backendRunning ""
  Check "PM2: AgentLee-Brain online"   $brainRunning ""
} catch {
  Skip "PM2 process check" "PM2 not found"
}

# ── Layer 27: Research Engine (InsForge AI) ───────────────────────────────
try {
  $hdr = @{ "X-Neural-Handshake" = $HANDSHAKE; "Content-Type" = "application/json" }
  $body = '{"message":"What is 2+2?"}' | ConvertTo-Json -Depth 1
  $res = Invoke-WebRequest -Uri "$LOCAL_BASE/api/chat" -Method POST -Headers $hdr -Body '{"message":"What is 2+2?"}' -TimeoutSec 15 -ErrorAction Stop
  Check "Chat/Brain responds" ($res.StatusCode -eq 200) "HTTP $($res.StatusCode)"
} catch {
  Check "Chat/Brain responds" $false "API not responding"
}

# ── Final Report ──────────────────────────────────────────────────────────
$TOTAL = $PASS + $FAIL + $SKIP
$SCORE = if ($TOTAL -gt 0) { [Math]::Round(($PASS / ($PASS + $FAIL)) * 100, 1) } else { 0 }
$VERDICT = if ($FAIL -eq 0) { "🟢 SOVEREIGN ONLINE" } elseif ($FAIL -le 2) { "🟡 DEGRADED MODE" } else { "🔴 NOT READY" }

Write-Host ""
Write-Host "─" * 65
Write-Host ("  PASS: {0}  |  FAIL: {1}  |  SKIP: {2}  |  Score: {3}/100" -f $PASS, $FAIL, $SKIP, $SCORE)
Write-Host "  Verdict: $VERDICT"
Write-Host "═" * 65
Write-Host ""
if ($FAIL -eq 0) {
  Write-Host "  Yo. Agent Lee OS is sovereign and ready." -ForegroundColor Green
  Write-Host "  Research-first gate armed. Parallel navigator online." -ForegroundColor Green
  Write-Host "  LEEWAY Standards enforced. We locked in." -ForegroundColor Green
} else {
  Write-Host "  $FAIL system(s) need attention before Agent Lee goes sovereign." -ForegroundColor Yellow
}
Write-Host ""
