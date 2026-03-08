$snapshotDir = "C:\Tools\Portable-VSCode-MCP-Kit\snapshots"
if (Test-Path $snapshotDir) {
    Get-ChildItem $snapshotDir | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
    $latest = Get-ChildItem $snapshotDir | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        Write-Host "`n🔍 Inspecting Latest Resurrection Artifact: $($latest.Name)" -ForegroundColor Cyan
        Get-Content $latest.FullName | ConvertFrom-Json | ConvertTo-Json -Depth 10
    } else {
        Write-Host "🚨 ERROR: No snapshots found! The Bottom Layer failed to capture the state." -ForegroundColor Red
    }
} else {
    Write-Host "🚨 ERROR: Snapshot directory not found: $snapshotDir" -ForegroundColor Red
}
