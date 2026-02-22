$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot"
Write-Host "PWD: $PSScriptRoot" -ForegroundColor Cyan
node src/tool.js testsprite
node src/tool.js playwright
node src/tool.js insforge
node src/tool.js stitch
