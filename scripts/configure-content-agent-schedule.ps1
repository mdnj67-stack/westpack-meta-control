param(
    [string]$EnvironmentFile = ".env.agent-prod.tmp"
)

$workspace = [IO.Path]::GetFullPath((Get-Location).Path)
$environmentPath = [IO.Path]::GetFullPath((Join-Path $workspace $EnvironmentFile))
$workspacePrefix = $workspace + [IO.Path]::DirectorySeparatorChar

if (-not $environmentPath.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Environment file must stay inside the workspace."
}

try {
    $environment = @{}
    Get-Content -LiteralPath $environmentPath | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim()
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $environment[$key] = $value
        }
    }

    if (-not $environment.QSTASH_TOKEN -or -not $environment.CRON_SECRET) {
        throw "Required scheduler credentials are unavailable."
    }

    $scheduleId = "westpack-content-agent-hourly"
    $destination = "https://project-4fcxa.vercel.app/api/campaign/brain"
    $encodedDestination = $destination
    $authorization = "Bearer $($environment.QSTASH_TOKEN)"

    $headers = @{
        Authorization                    = $authorization
        "Content-Type"                   = "text/plain"
        "Upstash-Cron"                   = "0 * * * *"
        "Upstash-Schedule-Id"            = $scheduleId
        "Upstash-Method"                 = "GET"
        "Upstash-Forward-Authorization"  = "Bearer $($environment.CRON_SECRET)"
        "Upstash-Forward-X-Content-Agent-Action" = "agent_scan"
        "Upstash-Retries"                = "2"
        "Upstash-Redact-Fields"          = "header[Authorization]"
    }

    $createUri = "https://qstash.upstash.io/v2/schedules/$encodedDestination"
    $created = Invoke-RestMethod -Method Post -Uri $createUri -Headers $headers -Body ""
    $schedules = Invoke-RestMethod -Method Get -Uri "https://qstash.upstash.io/v2/schedules" -Headers @{
        Authorization = $authorization
    }
    $matchingSchedules = @($schedules | Where-Object { $_.scheduleId -eq $scheduleId })
    $schedule = $matchingSchedules | Select-Object -First 1
    $scheduleHeaderNames = @($schedule.header.PSObject.Properties.Name)

    [pscustomobject]@{
        created = [bool]$created.scheduleId
        scheduleId = $created.scheduleId
        matchingSchedules = $matchingSchedules.Count
        cron = $schedule.cron
        method = $schedule.method
        destination = $schedule.destination
        paused = $schedule.isPaused
        actionHeaderConfigured = $scheduleHeaderNames -contains "X-Content-Agent-Action"
        authorizationHeaderConfigured = $scheduleHeaderNames -contains "Authorization"
    } | ConvertTo-Json -Compress
}
finally {
    if (Test-Path -LiteralPath $environmentPath) {
        Remove-Item -LiteralPath $environmentPath -Force
    }
}
