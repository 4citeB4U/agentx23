# Writes/updates antiGravityReal.url inside ui.runtime.json.
# Use this to make ANTI-GRAVITY show as (REAL) and open the correct control surface from the UI.

param(
  [string]$BaseDir = "C:\Tools\Portable-VSCode-MCP-Kit",
  [Parameter(Mandatory=$true)][string]$Url
)

$ErrorActionPreference = "Stop"

$UiConfigPath = Join-Path $BaseDir "ui.runtime.json"

$existing = $null
if (Test-Path $UiConfigPath) {
  try {
    $existing = Get-Content -Path $UiConfigPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
  } catch { $existing = $null }
}

$obj = [ordered]@{
  updatedAt = (Get-Date).ToString("o")
}

if ($existing -and $existing.vscodeReal) { $obj.vscodeReal = $existing.vscodeReal }

$obj.antiGravityReal = [ordered]@{
  mode = "url"
  url  = $Url.Trim()
}

($obj | ConvertTo-Json -Depth 6) | Set-Content -Path $UiConfigPath -Encoding UTF8

Write-Host "Wrote antiGravityReal.url to: $UiConfigPath" -ForegroundColor Green
Write-Host "  $($Url.Trim())" -ForegroundColor White
