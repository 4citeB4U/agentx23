# Starts a VS Code Remote Tunnel without requiring Administrator privileges.
# - Runs `code tunnel` in the current user session
# - Captures the vscode.dev tunnel URL from output
# - Writes it to ui.runtime.json so the UI can show VS CODE (REAL)

param(
  [string]$BaseDir = "C:\Tools\Portable-VSCode-MCP-Kit",
  [string]$TunnelName = "agent-lee-tunnel",
  [int]$WaitSeconds = 120,
  [switch]$Open
)

$ErrorActionPreference = "Stop"

$UiConfigPath = Join-Path $BaseDir "ui.runtime.json"
$OutDir = Join-Path $BaseDir "workspace\runtime"
$LogPath = Join-Path $OutDir "vscode-tunnel.log"
$UrlCachePath = Join-Path $OutDir "vscode-tunnel.url.txt"

function Ensure-Dir([string]$p) { New-Item -ItemType Directory -Force -Path $p | Out-Null }

function Get-CodeCmd {
  $cmd = Get-Command code -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = @(
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles(x86)\Microsoft VS Code\bin\code.cmd"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($fallback) { return $fallback }
  return $null
}

function Extract-TunnelUrl([string]$text) {
  if (-not $text) { return $null }
  $m = [regex]::Match($text, 'https://vscode\.dev/tunnel/[A-Za-z0-9\-_]+(?:/[A-Za-z0-9\-_]+)?', 'IgnoreCase')
  if ($m.Success) { return $m.Value }
  $m2 = [regex]::Match($text, 'https://vscode\.dev/[^\s"''\)]+', 'IgnoreCase')
  if ($m2.Success) { return $m2.Value }
  return $null
}

function Write-UiRuntime([string]$url) {
  $obj = [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    vscodeReal = [ordered]@{
      mode = "tunnel"
      url  = $url
      name = $TunnelName
    }
  }

  if (Test-Path $UiConfigPath) {
    try {
      $existing = Get-Content -Path $UiConfigPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($existing) {
        if ($existing.antiGravityReal) { $obj.antiGravityReal = $existing.antiGravityReal }
      }
    } catch { }
  }

  ($obj | ConvertTo-Json -Depth 6) | Set-Content -Path $UiConfigPath -Encoding UTF8
}

Ensure-Dir $OutDir

$codeCmd = Get-CodeCmd
if (-not $codeCmd) {
  throw "VS Code command not found. Install VS Code and ensure 'code' is in PATH."
}

Write-Host "Starting VS Code tunnel (non-admin)..." -ForegroundColor Cyan
Write-Host "- Tunnel name: $TunnelName"
Write-Host "- Log: $LogPath"

# Start the tunnel in a separate PowerShell window so it can keep running.
# Append all output to the log.
$psArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "& '$codeCmd' tunnel --name '$TunnelName' --accept-server-license-terms *>> '$LogPath'"
)

Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -WindowStyle Minimized | Out-Null

# Wait for URL in logs
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$url = $null

if (Test-Path $UrlCachePath) {
  $cached = (Get-Content $UrlCachePath -Raw -ErrorAction SilentlyContinue).Trim()
  if ($cached) { $url = $cached }
}

while (-not $url -and (Get-Date) -lt $deadline) {
  if (Test-Path $LogPath) {
    $tail = Get-Content $LogPath -Tail 200 -ErrorAction SilentlyContinue | Out-String
    $url = Extract-TunnelUrl $tail
  }
  if (-not $url) { Start-Sleep -Milliseconds 750 }
}

if (-not $url) {
  throw "Tunnel URL not detected within $WaitSeconds seconds. Open $LogPath and look for the vscode.dev link."
}

$url = $url.Trim()
$url | Set-Content -Path $UrlCachePath -Encoding UTF8
Write-UiRuntime -url $url

Write-Host "VS Code tunnel URL:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor White
Write-Host "Wrote: $UiConfigPath" -ForegroundColor DarkGray

if ($Open) {
  Start-Process $url | Out-Null
}
