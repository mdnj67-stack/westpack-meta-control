$configPath = Join-Path $PSScriptRoot "meta-config.json"
$outputDir = Join-Path $PSScriptRoot "data"
$outputPath = Join-Path $outputDir "meta-live.json"

if (-not (Test-Path $configPath)) {
  Write-Error "Missing meta-config.json. Create it from meta-config.template.json first."
  exit 1
}

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$config = Get-Content $configPath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($config.accessToken) -or $config.accessToken -like "PASTE_*") {
  Write-Error "meta-config.json does not contain a real access token."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($config.adAccountId) -or $config.adAccountId -like "PASTE_*") {
  Write-Error "meta-config.json does not contain a real ad account id."
  exit 1
}

$accountId = $config.adAccountId
if (-not $accountId.StartsWith("act_")) {
  $accountId = "act_$accountId"
}

$headers = @{
  Authorization = "Bearer $($config.accessToken)"
}

function Invoke-MetaGet {
  param(
    [string]$Uri
  )

  return Invoke-RestMethod -Uri $Uri -Headers $headers -Method Get
}

try {
  $account = Invoke-MetaGet -Uri "https://graph.facebook.com/v25.0/$accountId`?fields=id,name,account_status"

  $campaignResponse = Invoke-MetaGet -Uri "https://graph.facebook.com/v25.0/$accountId/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=100"
  $activeCampaigns = @($campaignResponse.data | Where-Object { $_.status -eq "ACTIVE" })

  $campaignInsights = @{}
  foreach ($campaign in $activeCampaigns) {
    $insight = Invoke-MetaGet -Uri "https://graph.facebook.com/v25.0/$($campaign.id)/insights?fields=spend,ctr,cpc,impressions,clicks,campaign_name&date_preset=last_7d&limit=1"
    if ($insight.data.Count -gt 0) {
      $campaignInsights[$campaign.id] = $insight.data[0]
    }
  }

  $adResponse = Invoke-MetaGet -Uri "https://graph.facebook.com/v25.0/$accountId/ads?fields=id,name,status,campaign{id,name},adset{id,name},creative{id,name}&limit=100"
  $activeAds = @($adResponse.data | Where-Object {
    $_.status -eq "ACTIVE" -and $_.campaign -and ($activeCampaigns.id -contains $_.campaign.id)
  })

  $stats = @()
  $stats += [PSCustomObject]@{
    label = "Active campaigns"
    value = [string]$activeCampaigns.Count
    meta = "Live Meta sync"
  }
  $stats += [PSCustomObject]@{
    label = "Active ads"
    value = [string]$activeAds.Count
    meta = "Live Meta sync"
  }

  $totalSpend = 0.0
  $ctrValues = @()
  foreach ($campaign in $activeCampaigns) {
    if ($campaignInsights.ContainsKey($campaign.id)) {
      $insightRow = $campaignInsights[$campaign.id]
      if ($insightRow.spend) {
        $totalSpend += [double]$insightRow.spend
      }
      if ($insightRow.ctr) {
        $ctrValues += [double]$insightRow.ctr
      }
    }
  }

  $averageCtr = if ($ctrValues.Count -gt 0) {
    ($ctrValues | Measure-Object -Average).Average
  } else {
    0
  }

  $stats += [PSCustomObject]@{
    label = "Spend last 7 days"
    value = ("EUR {0:N2}" -f $totalSpend)
    meta = "Live insights"
  }
  $stats += [PSCustomObject]@{
    label = "Average CTR"
    value = ("{0:N2}%" -f $averageCtr)
    meta = "Active campaigns only"
  }

  $campaigns = foreach ($campaign in $activeCampaigns) {
    $insight = $campaignInsights[$campaign.id]
    [PSCustomObject]@{
      id = $campaign.id
      name = $campaign.name
      market = ""
      spend = if ($insight.spend) { "EUR {0:N2}" -f [double]$insight.spend } else { "EUR 0.00" }
      roas = ""
      ctr = if ($insight.ctr) { "{0:N2}%" -f [double]$insight.ctr } else { "0.00%" }
      status = "Healthy"
      objective = $campaign.objective
      daily_budget = $campaign.daily_budget
      lifetime_budget = $campaign.lifetime_budget
    }
  }

  $ads = foreach ($ad in $activeAds) {
    [PSCustomObject]@{
      id = $ad.id
      name = $ad.name
      campaign = $ad.campaign.name
      primary = "Live ad synced from Meta"
      headline = if ($ad.creative.name) { $ad.creative.name } else { "Creative headline not loaded yet" }
      description = "Creative details can be expanded in the next integration step."
      adset = if ($ad.adset.name) { $ad.adset.name } else { "" }
    }
  }

  $payload = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString("s")
    account = [PSCustomObject]@{
      id = $account.id
      name = $account.name
    }
    campaigns = @($campaigns)
    ads = @($ads)
    stats = @($stats)
  }

  $payload | ConvertTo-Json -Depth 8 | Set-Content -Path $outputPath -Encoding UTF8
  Write-Host "Meta sync completed."
  Write-Host "Saved live snapshot to $outputPath"
}
catch {
  Write-Error $_.Exception.Message
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  exit 1
}
