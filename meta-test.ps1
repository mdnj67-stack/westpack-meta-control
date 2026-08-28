$configPath = Join-Path $PSScriptRoot "meta-config.json"

if (-not (Test-Path $configPath)) {
  Write-Error "Missing meta-config.json. Copy meta-config.template.json to meta-config.json and fill in appId, adAccountId, and accessToken."
  exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($config.accessToken) -or $config.accessToken -like "PASTE_*") {
  Write-Error "meta-config.json does not contain a real access token yet."
  exit 1
}

$headers = @{
  Authorization = "Bearer $($config.accessToken)"
}

try {
  $me = Invoke-RestMethod -Uri "https://graph.facebook.com/v25.0/me?fields=id,name" -Headers $headers -Method Get
  $accounts = Invoke-RestMethod -Uri "https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name,account_status" -Headers $headers -Method Get

  Write-Host "Meta token test succeeded."
  Write-Host ""
  Write-Host "User:"
  $me | ConvertTo-Json -Depth 5
  Write-Host ""
  Write-Host "Ad Accounts:"
  $accounts | ConvertTo-Json -Depth 8
}
catch {
  Write-Error $_.Exception.Message
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  exit 1
}
