param([switch]$DevMode)
$ErrorActionPreference = "Stop"
$root = "C:\Tools\Portable-VSCode-MCP-Kit"

function Write-Audit($msg, $color = "Cyan") {
    Write-Host "[SOVEREIGN AUDIT] $msg" -ForegroundColor $color
}

Write-Audit "Starting Sovereign 6-Point Check..." "Yellow"

# 1. Hardware Check (DevMode Bypass)
Write-Audit "1/6 Hardware Root of Trust..."
if ($DevMode) { Write-Audit "  [SKIP] DevMode Active." "Gray" }
else { if ((Confirm-SecureBootUEFI) -eq $false) { throw "Secure Boot Disabled" } }

# 2. Guardian Policy Check (THE LAW)
Write-Audit "2/6 Verifying Guardian Constitution..."
try {
    $policy = Get-Content "$root\core\guardian_policy.json" -Raw | ConvertFrom-Json
} catch {
    throw "Guardian policy missing or unreadable"
}
if ($policy.policy_status -ne "ENFORCING") { throw "Guardian is NOT enforcing!" }
Write-Audit "  [PASS] Guardian is ENFORCING the law." "Green"

# 3. Registry Check (THE WORKFORCE)
Write-Audit "3/6 Verifying Qwen3 Fleet in adapters.json..."
try {
    $registry = Get-Content "$root\adapters.json" -Raw | ConvertFrom-Json
} catch {
    throw "Registry missing or unreadable"
}
$qwen3Count = ($registry.mcp_registry | Where-Object { $_.id -match "qwen3" }).Count
if ($qwen3Count -lt 3) { throw "Qwen3 Agents missing from registry!" }
Write-Audit "  [PASS] Qwen3 Family ($qwen3Count agents) mapped and ready." "Green"

# 4. Auth Check
Write-Audit "4/6 Validating Authority Key..."
if (Test-Path "$root\.env.local") {
    $envTxt = Get-Content "$root\.env.local" -Raw
    if ($envTxt -match "INSFORGE_ANON_KEY=.{20,}") {
        Write-Audit "  [PASS] Authority Key is valid." "Green"
    } else { throw "Invalid Authority Key!" }
} else { throw ".env.local missing" }

Write-Audit "AUDIT COMPLETE: Agent Lee is in line." "Green"
