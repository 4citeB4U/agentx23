# =====================================================================
# Docker-Diag.ps1 (known-good)
# Goals:
#  - Never false-positive on npipe:// (no generic "pipe" matching)
#  - Auto-runs hello-world + port publish test
#  - Outputs a simple PASS/FAIL matrix (+ writes artifacts to a timestamped folder)
# =====================================================================

$ErrorActionPreference = "Continue"

function Write-Section([string]$t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Test-Cmd([string]$name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Add-Result([System.Collections.Generic.List[object]]$list, [string]$Name, [bool]$Pass, [string]$Details) {
  $list.Add([PSCustomObject]@{
    Check   = $Name
    Result  = $(if ($Pass) { "PASS" } else { "FAIL" })
    Details = $Details
  }) | Out-Null
}

# ---------- report folder ----------
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$root  = Join-Path (Get-Location).Path "docker-report-$stamp"
New-Item -ItemType Directory -Path $root -Force | Out-Null

$results = New-Object System.Collections.Generic.List[object]

Write-Section "Environment"
$envInfo = [PSCustomObject]@{
  Timestamp   = (Get-Date).ToString("o")
  User        = $env:USERNAME
  Computer    = $env:COMPUTERNAME
  PSVersion   = $PSVersionTable.PSVersion.ToString()
  PSEdition   = $PSVersionTable.PSEdition
  OS          = (Get-CimInstance Win32_OperatingSystem).Caption
  OSBuild     = (Get-CimInstance Win32_OperatingSystem).BuildNumber
  IsAdmin     = ([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole(
                  [Security.Principal.WindowsBuiltInRole]::Administrator
               )
  PATHDocker  = (Get-Command docker -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
  PATHCompose = (Get-Command docker-compose -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
}
$envInfo | ConvertTo-Json -Depth 6 | Out-File (Join-Path $root "00-env.json") -Encoding utf8
$envInfo | Format-List             | Out-File (Join-Path $root "00-env.txt") -Encoding utf8
$envInfo | Format-List

Write-Section "Command availability"
$cmds = @("docker","docker-compose","wsl","netsh")
$cmdTable = foreach ($c in $cmds) {
  [PSCustomObject]@{
    Command = $c
    Present = (Test-Cmd $c)
    Path    = (Get-Command $c -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
  }
}
$cmdTable | Format-Table -AutoSize
$cmdTable | ConvertTo-Json -Depth 6 | Out-File (Join-Path $root "01-commands.json") -Encoding utf8

if (-not (Test-Cmd "docker")) {
  Add-Result $results "Docker CLI in PATH" $false "docker.exe not found"
  Write-Section "PASS/FAIL Matrix"
  $results | Format-Table -AutoSize
  $results | Export-Csv (Join-Path $root "90-matrix.csv") -NoTypeInformation -Encoding utf8
  $results | ConvertTo-Json -Depth 6 | Out-File (Join-Path $root "90-matrix.json") -Encoding utf8
  Write-Host "Report folder: $root" -ForegroundColor Cyan
  exit 1
}

Add-Result $results "Docker CLI in PATH" $true $envInfo.PATHDocker

Write-Section "Docker version + info (daemon connectivity)"
$dockerVersion = (docker version 2>&1)
$dockerInfo    = (docker info 2>&1)

$dockerVersion | Out-File (Join-Path $root "10-docker-version.txt") -Encoding utf8
$dockerInfo    | Out-File (Join-Path $root "11-docker-info.txt") -Encoding utf8

# Robust failure detection: ONLY match real failure phrases; do NOT match "pipe" generically.
$dvText = $dockerVersion -join "`n"
$diText = $dockerInfo -join "`n"

$failurePatterns = @(
  'Cannot connect to the Docker daemon',
  'error during connect',
  'is the docker daemon running',
  'daemon is not running',
  'This error may indicate',
  'The system cannot find the file specified',
  'open //\./pipe/',            # real pipe open error
  'open \\\\.\\pipe\\',          # real windows pipe open error
  'connection refused',
  'context deadline exceeded',
  'dial unix',
  'dial tcp'
)

$daemonOk = $true
foreach ($p in $failurePatterns) {
  if (($dvText -match $p) -or ($diText -match $p)) { $daemonOk = $false; break }
}

$ctx = (docker context show 2>$null)
if (-not $ctx) { $ctx = "unknown" }

if ($daemonOk) {
  $serverLine = (docker info --format "Server={{.ServerVersion}}; OSType={{.OSType}}; CPUs={{.NCPU}}; Mem={{.MemTotal}}" 2>$null)
  Add-Result $results "Daemon reachable (docker version/info)" $true ("Context={0}; {1}" -f $ctx, $serverLine)
} else {
  Add-Result $results "Daemon reachable (docker version/info)" $false ("Context={0}; see 10/11 txt" -f $ctx)
}

# readable console output (line-by-line)
$dockerVersion | ForEach-Object { Write-Host $_ }
Write-Host ""
$dockerInfo    | ForEach-Object { Write-Host $_ }

Write-Section "Docker contexts"
$ctxList = docker context ls 2>&1
$ctxList | Out-File (Join-Path $root "12-docker-contexts.txt") -Encoding utf8
$ctxList

Write-Section "Functional test: hello-world"
$helloOk = $false
$helloOut = docker run --rm hello-world 2>&1
$helloOut | Out-File (Join-Path $root "60-hello-world.txt") -Encoding utf8
if (($helloOut -join "`n") -match "Hello from Docker!") { $helloOk = $true }
Add-Result $results "Run container (hello-world)" $helloOk $(if ($helloOk) { "hello-world succeeded" } else { "hello-world failed; see 60-hello-world.txt" })
$helloOut

Write-Section "Functional test: port publish (nginx -> http://localhost:8088)"
$portOk = $false
$containerName = "ps-port-test"
$port = 8088

try {
  docker rm -f $containerName 2>$null | Out-Null
  $runOut = docker run -d --name $containerName -p "$port`:80" nginx 2>&1
  $runOut | Out-File (Join-Path $root "61-porttest-run.txt") -Encoding utf8

  Start-Sleep 2

  $resp = Invoke-WebRequest "http://localhost:$port" -UseBasicParsing -TimeoutSec 10
  $probe = [PSCustomObject]@{ StatusCode = $resp.StatusCode; StatusDescription = $resp.StatusDescription }
  $probe | ConvertTo-Json -Depth 4 | Out-File (Join-Path $root "62-porttest-probe.json") -Encoding utf8

  if ($resp.StatusCode -eq 200) { $portOk = $true }
} catch {
  $_ | Out-File (Join-Path $root "62-porttest-error.txt") -Encoding utf8
} finally {
  docker rm -f $containerName 2>$null | Out-Null
}

Add-Result $results "Port publish (localhost:$port -> nginx)" $portOk $(if ($portOk) { "HTTP 200 OK" } else { "Failed; see 61/62 files" })

Write-Section "Inventory dumps"
docker ps -a 2>&1      | Out-File (Join-Path $root "20-containers.txt") -Encoding utf8
docker images 2>&1     | Out-File (Join-Path $root "21-images.txt") -Encoding utf8
docker network ls 2>&1 | Out-File (Join-Path $root "22-networks.txt") -Encoding utf8
docker volume ls 2>&1  | Out-File (Join-Path $root "23-volumes.txt") -Encoding utf8
Write-Host "Saved: containers/images/networks/volumes lists" -ForegroundColor Green

Write-Section "WSL status (optional)"
if (Test-Cmd "wsl") {
  wsl --status 2>&1 | Out-File (Join-Path $root "40-wsl-status.txt") -Encoding utf8
  wsl -l -v 2>&1    | Out-File (Join-Path $root "41-wsl-distros.txt") -Encoding utf8
  Add-Result $results "WSL available" $true "Saved 40/41 files"
} else {
  Add-Result $results "WSL available" $false "wsl.exe not found"
}

Write-Section "PASS/FAIL Matrix"
$results | Format-Table -AutoSize
$results | Export-Csv (Join-Path $root "90-matrix.csv") -NoTypeInformation -Encoding utf8
$results | ConvertTo-Json -Depth 6 | Out-File (Join-Path $root "90-matrix.json") -Encoding utf8
Write-Host "Report folder: $root" -ForegroundColor Cyan

# ---------- exit code (CI-friendly) ----------
if ($results | Where-Object Result -eq "FAIL") { exit 1 } else { exit 0 }

