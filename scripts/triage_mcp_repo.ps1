# Check if script is running as Admin (optional, but recommended for some operations)
# if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
#     Write-Warning "Running without administrator privileges. Some operations may fail."
# }

param (
    [string]$Root = "C:\Tools\Portable-VSCode-MCP-Kit",
    [switch]$UpdateVsCodeSettings,
    [switch]$WriteRequirementsHints,
    [switch]$Apply
)

$ReportPath = Join-Path $Root "repo-triage-report.md"
$MissingImports = @()
$JsonRepairNeeded = @()
$MarkdownFixNeeded = @()

Write-Host "--- 1. Python Import Auditor ---" -ForegroundColor Cyan
# Find Python files and check imports using AST or regex
$pyFiles = Get-ChildItem -Path $Root -Filter "*.py" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.venv|__pycache__" }

foreach ($f in $pyFiles) {
    try {
        $content = Get-Content $f.FullName -Raw
        # Look for 'import x' or 'from x import y'
        $imports = [regex]::Matches($content, '(?m)^\s*(?:import|from)\s+([a-zA-Z0-9_\.]+)')
        foreach ($imp in $imports) {
            $mod = $imp.Groups[1].Value.Split('.')[0]
            # Check if common stdlib or local file. This is a heuristic.
            if ($mod -match "os|sys|time|re|json|datetime|pathlib|shutil|subprocess|threading|collections|typing") { continue }
            if (Test-Path (Join-Path $f.DirectoryName "$mod.py")) { continue }
            if (Test-Path (Join-Path $f.DirectoryName $mod)) { continue }
            
            # Record potentially missing module
            $MissingImports += [PSCustomObject]@{ File = $f.FullName; Module = $mod }
        }
    } catch {}
}

Write-Host "--- 2. JSON Repair Agent ---" -ForegroundColor Cyan
$jsonFiles = Get-ChildItem -Path $Root -Filter "*.json" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.venv" }
foreach ($f in $jsonFiles) {
    try {
        $j = Get-Content $f.FullName -Raw
        $j | ConvertFrom-Json -ErrorAction Stop > $null
    } catch {
        Write-Warning "JSON Error in $($f.Name): $($_.Exception.Message)"
        $JsonRepairNeeded += $f.FullName
        if ($Apply) {
            # Heuristic repairs: remove trailing commas, remove comments
            $repaired = $j -replace ',\s*([\]\}])', '$1' # Trailing comma
            $repaired = $repaired -replace '(?m)^\s*//.*$', ''   # Single line comment
            $repaired = $repaired -replace '(?s)/\*.*?\*/', ''   # Multi-line comment (aggressive)
            try {
                $repaired | ConvertFrom-Json -ErrorAction Stop > $null
                $repaired | Set-Content $f.FullName
                Write-Host "  [Fixed] $($f.Name)" -ForegroundColor Green
            } catch {
                Write-Error "  [Fail] Could not auto-fix $($f.Name)"
            }
        }
    }
}

Write-Host "--- 3. Markdown Hygiene Agent ---" -ForegroundColor Cyan
$mdFiles = Get-ChildItem -Path $Root -Filter "*.md" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules" }
foreach ($f in $mdFiles) {
    $needsFix = $false
    $m = Get-Content $f.FullName -Raw
    if ($m -match "\t") { $needsFix = $true }
    if ($m -match " +$") { $needsFix = $true }
    if ($m -notmatch "\n$") { $needsFix = $true }

    if ($needsFix) {
        $MarkdownFixNeeded += $f.FullName
        if ($Apply) {
            $m = $m -replace "\t", "  "
            $m = $m -replace " +$", ""
            if ($m -notmatch "\n$") { $m += "`n" }
            $m | Set-Content $f.FullName
            Write-Host "  [Cleaned] $($f.Name)" -ForegroundColor Green
        }
    }
}

# Generate Report
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# Repo Triage Report - $($Root)")
[void]$sb.AppendLine("Run Date: $(Get-Date)")
[void]$sb.AppendLine("Mode: $(if($Apply){'Apply'}else{'Dry Run'})")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Summary")
[void]$sb.AppendLine("* Python Import Issues: $($MissingImports.Count)")
[void]$sb.AppendLine("* JSON Repair Needed: $($JsonRepairNeeded.Count)")
[void]$sb.AppendLine("* Markdown Hygiene Issues: $($MarkdownFixNeeded.Count)")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Python Imports (Top Missing Candidates)")
$MissingImports | Group-Object Module | Sort-Object Count -Descending | ForEach-Object { [void]$sb.AppendLine("- **$($_.Name)** (used in $($_.Count) files)") }
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Broken JSON Files")
$JsonRepairNeeded | ForEach-Object { [void]$sb.AppendLine("- [ ] $($_.Replace($Root, ''))") }
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Markdown Hygiene Items")
$MarkdownFixNeeded | ForEach-Object { [void]$sb.AppendLine("- [ ] $($_.Replace($Root, ''))") }

$sb.ToString() | Set-Content $ReportPath
Write-Host "Report written to: $ReportPath" -ForegroundColor Cyan
