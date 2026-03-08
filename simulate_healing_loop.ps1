$baseUrl = "http://localhost:8000/api/mcp/execute"

function Log-Stage($msg) {
    Write-Host "`n--- $msg ---" -ForegroundColor Cyan
}

# --- STEP 1: HEALTH MONITOR DETECTS ANOMALY ---
Log-Stage "1. Health Monitor reporting status of 'James Schedule App'"
$healthPayload = @{
    agent_id = "qwen3-health-mcp"
    action   = "check_system_health"
    payload  = @{ app_id = "james-schedule-v1"; status = "degraded"; error = "UI_RENDER_FAILURE" }
}
Invoke-RestMethod -Uri $baseUrl -Method Post -Body ($healthPayload | ConvertTo-Json) -ContentType "application/json"


# --- STEP 2: VISION AGENT ANALYZES THE BROKEN UI ---
Log-Stage "2. Vision Agent analyzing 'James Schedule App' UI"
$visionPayload = @{
    agent_id = "qwen3-vision-mcp"
    action   = "analyze_screenshot"
    payload  = @{ app_id = "james-schedule-v1"; image_data = "base64_placeholder"; detection = "Submit button misaligned" }
}
Invoke-RestMethod -Uri $baseUrl -Method Post -Body ($visionPayload | ConvertTo-Json) -ContentType "application/json"


# --- STEP 3: CODER AGENT ATTEMPTS A PATCH (HIGH RISK) ---
Log-Stage "3. Coder Agent generating UI Patch (Requires Guardian Approval)"
$coderPayload = @{
    agent_id = "qwen3-coder-mcp"
    action   = "patch_ui_component"
    payload  = @{ 
        app_id = "james-schedule-v1"
        patch  = "Fix button CSS alignment"
        risk_level = "high" 
    }
}

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body ($coderPayload | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Guardian Result: $($response.status) - $($response.log)" -ForegroundColor Green
} catch {
    Write-Host "Guardian Result: DENIED - $($_.Exception.Message)" -ForegroundColor Red
}

Log-Stage "Simulation Complete. Check server.py logs for Audit Trail."
