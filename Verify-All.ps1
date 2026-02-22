# Verify-All.ps1 — Agent Lee v1 stack verifier
# Run: .\Verify-All.ps1
# Returns exit 0 if all checks pass, exit 1 on any failure.

$ErrorActionPreference = "Stop"
$py   = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$pass = $true

function Check-Ok { param($label, $ok, $detail="")
  $icon = if ($ok) { "[PASS]" } else { "[FAIL]" }
  $col  = if ($ok) { "Green"  } else { "Red"    }
  Write-Host ("{0,-6} {1,-48} {2}" -f $icon, $label, $detail) -ForegroundColor $col
  if (-not $ok) { $script:pass = $false }
}

Write-Host "`n== Verify-All.ps1 — Agent Lee v1 ==" -ForegroundColor Cyan
Write-Host ("-" * 60)

# ── 1. Python syntax ────────────────────────────────────────────────────────
Write-Host "`n[1] Python syntax" -ForegroundColor Cyan
$pyFiles = @( "server.py", "scripts\synthetic_job.py", "scripts\train_lora.py" )
foreach ($f in $pyFiles) {
  $abs = Join-Path $PSScriptRoot $f
  try {
    $cmd = 'import ast; ast.parse(open("{0}", encoding="utf-8").read()); print("ok")' -f $abs
    $result = & $py -c $cmd 2>&1
    Check-Ok "syntax: $f" ($result -match "ok")
  } catch {
    Check-Ok "syntax: $f" $false "$_"
  }
}

# ── 2. UTF-8 / no-BOM validation ───────────────────────────────────────────
Write-Host "`n[2] UTF-8 no-BOM check" -ForegroundColor Cyan
$encFiles = Get-ChildItem $PSScriptRoot -Recurse -File -Include *.py,*.ps1,*.json,*.yml,*.yaml `
  | Where-Object { $_.FullName -notmatch '\\(.venv|node_modules|\.git|dist|lora_adapters)\\' }

$badEnc = @()
foreach ($fi in $encFiles) {
  $bytes = [IO.File]::ReadAllBytes($fi.FullName)
  # BOM check
  if ($bytes.Count -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $badEnc += "$($fi.FullName) [has UTF-8 BOM]"
    continue
  }
  # Strict UTF-8 decode
  try { [Text.Encoding]::UTF8.GetString($bytes) | Out-Null }
  catch { $badEnc += "$($fi.FullName) [non-UTF-8 bytes]" }
}
if ($badEnc.Count -eq 0) {
  Check-Ok "all scanned files" $true "UTF-8 NoBOM"
} else {
  foreach ($b in $badEnc) { Check-Ok "encoding" $false $b }
}

# ── 3. Docker compose config valid ─────────────────────────────────────────
Write-Host "`n[3] Docker compose config" -ForegroundColor Cyan
try {
  $cfg = docker compose config 2>&1
  Check-Ok "docker compose config" ($LASTEXITCODE -eq 0) "parsed ok"
} catch {
  Check-Ok "docker compose config" $false "$_"
}

# ── 4. Live endpoints ───────────────────────────────────────────────────────
Write-Host "`n[4] Live endpoints" -ForegroundColor Cyan
$endpoints = @(
  @{ Label="Brain /health";    Url="http://127.0.0.1:8004/health"    },
  @{ Label="Brain /ai-status"; Url="http://127.0.0.1:8004/ai-status" },
  @{ Label="Backend /health";  Url="http://127.0.0.1:8001/health"    }
)
foreach ($ep in $endpoints) {
  try {
    $r = Invoke-RestMethod $ep.Url -TimeoutSec 5
    $detail = ($r | ConvertTo-Json -Compress -Depth 1).Substring(0, [Math]::Min(80, ($r | ConvertTo-Json -Compress -Depth 1).Length))
    Check-Ok $ep.Label $true $detail
  } catch {
    Check-Ok $ep.Label $false $_.Exception.Message
  }
}

# ── 5. Episode DB exists ────────────────────────────────────────────────────
Write-Host "`n[5] Episode DB" -ForegroundColor Cyan
$dbPath = Join-Path $PSScriptRoot "workspace\episodes.db"
Check-Ok "workspace\episodes.db" (Test-Path $dbPath)

# ── 6. Adapters registry ────────────────────────────────────────────────────
Write-Host "`n[6] Adapters registry" -ForegroundColor Cyan
$adPath = Join-Path $PSScriptRoot "workspace\adapters.json"
Check-Ok "workspace\adapters.json" (Test-Path $adPath)

# ── Summary ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ("-" * 60)
if ($pass) {
  Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
  exit 0
} else {
  Write-Host "ONE OR MORE CHECKS FAILED - see [FAIL] lines above" -ForegroundColor Red
  exit 1
}
