#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Agent Lee Tier 0 Preflight — PowerShell launcher
  LEEWAY-CORE-2026

.DESCRIPTION
  Runs the TypeScript preflight suite via tsx, then prints a pass/fail summary.
  Exit code 0 = all clear. Exit code 1 = one or more hard failures.

.EXAMPLE
  .\scripts\test-preflight.ps1
  .\scripts\test-preflight.ps1 -Verbose
#>

param(
  [switch]$Verbose,
  [switch]$Force   # Skip integrity manifest check (use cautiously)
)

Set-Location $PSScriptRoot\..
$ROOT = Get-Location

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Agent Lee — Tier 0 Preflight Checks" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verify tsx is available
$tsx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $tsx) {
  Write-Error "npx not found. Install Node.js first."
  exit 1
}

# ── Check 1: TypeScript compile (backend) ──────────────────────────────────
Write-Host "  [ ] TypeScript (backend)..." -NoNewline
try {
  $out = & npx tsc --noEmit 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "`r  ✅  TypeScript (backend)" -ForegroundColor Green
  } else {
    Write-Host "`r  ❌  TypeScript (backend)" -ForegroundColor Red
    if ($Verbose) { Write-Host $out }
    $hardFail = $true
  }
} catch {
  Write-Host "`r  ❌  TypeScript (backend) — exception" -ForegroundColor Red
  $hardFail = $true
}

# ── Check 2: Public key present ─────────────────────────────────────────────
Write-Host "  [ ] Sovereign public key..." -NoNewline
if (Test-Path "$ROOT\golden\public.pem") {
  Write-Host "`r  ✅  Sovereign public key" -ForegroundColor Green
} else {
  Write-Host "`r  ⚠   Sovereign public key missing (run: npx tsx core/keyManager.ts generate)" -ForegroundColor Yellow
}

# ── Check 3: Manifest present ──────────────────────────────────────────────
Write-Host "  [ ] Integrity manifest..." -NoNewline
if (Test-Path "$ROOT\golden\manifest.json") {
  Write-Host "`r  ✅  Integrity manifest" -ForegroundColor Green
} else {
  Write-Host "`r  ⚠   Manifest missing (run: npx tsx core/integrityVerifier.ts generate)" -ForegroundColor Yellow
}

# ── Check 4: Snapshot exists ──────────────────────────────────────────────
Write-Host "  [ ] Golden snapshot..." -NoNewline
$snaps = @()
if (Test-Path "$ROOT\snapshots") {
  $snaps = Get-ChildItem "$ROOT\snapshots" -Filter "*.json" -ErrorAction SilentlyContinue
}
if ($snaps.Count -gt 0) {
  Write-Host "`r  ✅  Golden snapshot ($($snaps.Count) found)" -ForegroundColor Green
} else {
  Write-Host "`r  ⚠   No snapshots (run: npx tsx core/snapshotManager.ts create boot)" -ForegroundColor Yellow
}

# ── Check 5: npm audit ────────────────────────────────────────────────────
Write-Host "  [ ] npm audit (critical)..." -NoNewline
try {
  $auditOut = & npm audit --audit-level=critical 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "`r  ✅  npm audit (no criticals)" -ForegroundColor Green
  } else {
    Write-Host "`r  ⚠   npm audit found issues (review output)" -ForegroundColor Yellow
    if ($Verbose) { Write-Host $auditOut }
  }
} catch {
  Write-Host "`r  ⚠   npm audit failed (network issue?)" -ForegroundColor Yellow
}

# ── Summary ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($hardFail) {
  Write-Host "  ❌  PREFLIGHT FAILED — fix errors before proceeding" -ForegroundColor Red
  exit 1
} else {
  Write-Host "  ✅  PREFLIGHT PASSED — Agent Lee is cleared for launch" -ForegroundColor Green
  exit 0
}
