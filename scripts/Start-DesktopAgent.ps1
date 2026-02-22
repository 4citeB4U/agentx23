## Agent Lee – Desktop Agent Watchdog
## Keeps desktop_agent.py alive; checks port 8005 every 5 s and restarts if dead.
param(
    [string]$PythonExe = "C:\Python313\python.exe",
    [string]$AgentScript = "scripts\desktop_agent.py",
    [string]$WorkDir    = "c:\Tools\Portable-VSCode-MCP-Kit",
    [string]$LogOut     = "backend\logs\desktop_agent.log",
    [string]$LogErr     = "backend\logs\desktop_agent.err"
)

$null = New-Item -ItemType Directory -Force -Path "$WorkDir\backend\logs"

function IsAgentAlive {
    $listening = netstat -ano 2>$null | Select-String ":8005 .*LISTEN"
    return $null -ne $listening
}

while ($true) {
    if (-not (IsAgentAlive)) {
        $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$ts][watchdog] Port 8005 dead – restarting agent..."
        Add-Content "$WorkDir\$LogOut" "[$ts][watchdog] Restarting desktop agent"
        # Kill any stale process first
        netstat -ano 2>$null | Select-String ":8005 " | ForEach-Object {
            $pid = ($_ -split '\s+')[-1]
            if ($pid -match '^\d+$' -and $pid -ne '0') { Stop-Process -Id $pid -Force -EA SilentlyContinue }
        }
        Start-Sleep 1
        Start-Process $PythonExe `
            -ArgumentList $AgentScript `
            -WorkingDirectory $WorkDir `
            -RedirectStandardOutput "$WorkDir\$LogOut" `
            -RedirectStandardError  "$WorkDir\$LogErr" `
            -NoNewWindow
        Start-Sleep 8
    } else {
        Start-Sleep 5
    }
}
