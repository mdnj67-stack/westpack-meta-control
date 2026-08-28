$configPath = Join-Path $PSScriptRoot "klaviyo-config.json"
$outputDir = Join-Path $PSScriptRoot "data"
$outputJsonPath = Join-Path $outputDir "klaviyo-live.json"
$outputModulePath = Join-Path $outputDir "klaviyo-live.js"

if (-not (Test-Path $configPath)) {
  Write-Error "Missing klaviyo-config.json. Create it from klaviyo-config.template.json first."
  exit 1
}

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$revision = if ($config.revision) { [string]$config.revision } else { "2024-10-15" }
$timeframeDays = if ($config.timeframeDays) { [int]$config.timeframeDays } else { 30 }
$markets = @($config.markets)

if (-not $markets.Count) {
  Write-Error "klaviyo-config.json must contain at least one market."
  exit 1
}

$now = Get-Date
$fromDate = $now.AddDays(-$timeframeDays)
$fromIso = $fromDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss")
$toIso = $now.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss")

function New-KlaviyoHeaders {
  param(
    [string]$PrivateKey,
    [switch]$Json
  )

  $headers = @{
    Authorization = "Klaviyo-API-Key $PrivateKey"
    Accept = "application/json"
    revision = $revision
  }

  if ($Json) {
    $headers["Content-Type"] = "application/json"
  }

  return $headers
}

function Invoke-KlaviyoRequest {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [string]$Method = "GET",
    [object]$Body = $null
  )

  if ($Body -ne $null) {
    return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method $Method -Body ($Body | ConvertTo-Json -Depth 20)
  }

  return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method $Method
}

function Get-KlaviyoPages {
  param(
    [string]$Uri,
    [hashtable]$Headers
  )

  $items = @()
  $nextUri = $Uri
  while (-not [string]::IsNullOrWhiteSpace($nextUri)) {
    $response = Invoke-KlaviyoRequest -Uri $nextUri -Headers $Headers
    if ($response.data) {
      $items += @($response.data)
    }

    $nextUri = $null
    if ($response.links -and $response.links.next) {
      $nextUri = [string]$response.links.next
    }
  }

  return $items
}

function Get-MetricIdByName {
  param(
    [hashtable]$Headers,
    [string]$MetricName
  )

  $metrics = Get-KlaviyoPages -Uri "https://a.klaviyo.com/api/metrics/?page[size]=100" -Headers $Headers
  $match = $metrics | Where-Object { $_.attributes.name -eq $MetricName } | Select-Object -First 1
  if ($match) {
    return [string]$match.id
  }

  return $null
}

function Get-ReportValue {
  param(
    [object]$Report,
    [string]$Name
  )

  if ($null -eq $Report) { return $null }

  if ($Report.PSObject.Properties.Name -contains $Name) {
    return $Report.$Name
  }

  if ($Report.attributes -and $Report.attributes.PSObject.Properties.Name -contains $Name) {
    return $Report.attributes.$Name
  }

  if ($Report.statistics -and $Report.statistics.PSObject.Properties.Name -contains $Name) {
    return $Report.statistics.$Name
  }

  return $null
}

function Query-CampaignValues {
  param(
    [hashtable]$Headers,
    [string]$CampaignId,
    [string]$ConversionMetricId
  )

  $body = @{
    data = @{
      type = "campaign-values-report"
      attributes = @{
        timeframe = @{
          start = $fromIso
          end = $toIso
        }
        conversion_metric_id = $ConversionMetricId
        filter = @(
          @{
            field = "campaign_id"
            operator = "equals"
            value = $CampaignId
          }
        )
        statistics = @(
          "recipients",
          "open_rate",
          "click_rate",
          "unsubscribe_rate"
        )
        value_statistics = @(
          "conversion_value"
        )
      }
    }
  }

  $response = Invoke-KlaviyoRequest -Uri "https://a.klaviyo.com/api/campaign-values-reports/" -Headers $Headers -Method "POST" -Body $body
  if ($response.data -is [System.Array] -and $response.data.Count -gt 0) {
    return $response.data[0]
  }

  if ($response.data) {
    if ($response.data.attributes -and $response.data.attributes.results) {
      $results = @($response.data.attributes.results)
      if ($results.Count -gt 0) {
        return $results[0]
      }
    }
    return $response.data
  }

  return $null
}

function New-InsightCards {
  param(
    [array]$CampaignGroups,
    [array]$AllMarkets
  )

  $cards = @()
  if (-not $CampaignGroups.Count) {
    return @(
      [PSCustomObject]@{
        title = "No campaign data yet"
        body = "Run the Klaviyo sync and make sure the selected markets have sent campaigns inside the configured timeframe."
      }
    )
  }

  $worstOpen = $null
  $highestUnsub = $null
  foreach ($group in $CampaignGroups) {
    foreach ($market in @($group.markets)) {
      if (-not $worstOpen -or [double]$market.openRate -lt [double]$worstOpen.openRate) {
        $worstOpen = [PSCustomObject]@{
          country = $market.country
          openRate = $market.openRate
          campaignName = $group.campaignName
        }
      }
      if (-not $highestUnsub -or [double]$market.unsubRate -gt [double]$highestUnsub.unsubRate) {
        $highestUnsub = [PSCustomObject]@{
          country = $market.country
          unsubRate = $market.unsubRate
          campaignName = $group.campaignName
        }
      }
    }
  }

  $missingCoverage = $CampaignGroups | Where-Object { $_.missingMarkets.Count -gt 0 } | Select-Object -First 1
  if ($worstOpen) {
    $cards += [PSCustomObject]@{
      title = "Lowest open-rate market"
      body = "$($worstOpen.country) is the weakest opener right now on '$($worstOpen.campaignName)' with $([string]::Format('{0:N1}', [double]$worstOpen.openRate))% open rate."
    }
  }

  if ($highestUnsub) {
    $cards += [PSCustomObject]@{
      title = "Highest unsubscribe pressure"
      body = "$($highestUnsub.country) is carrying the highest unsubscribe rate on '$($highestUnsub.campaignName)' at $([string]::Format('{0:N2}', [double]$highestUnsub.unsubRate))%."
    }
  }

  if ($missingCoverage) {
    $cards += [PSCustomObject]@{
      title = "Missing market coverage"
      body = "'$($missingCoverage.campaignName)' is missing: $($missingCoverage.missingMarkets -join ', ')."
    }
  }

  if (-not $cards.Count) {
    $cards += [PSCustomObject]@{
      title = "Coverage looks clean"
      body = "All synced campaign families have full market coverage in the selected timeframe."
    }
  }

  return $cards
}

function ConvertTo-JavaScriptModule {
  param(
    [object]$Payload
  )

  $json = $Payload | ConvertTo-Json -Depth 20
  return @"
const klaviyoLiveSnapshot = $json;

export default klaviyoLiveSnapshot;
"@
}

try {
  $groupMap = @{}
  $marketCodes = @()

  foreach ($market in $markets) {
    $country = [string]$market.country
    $privateKey = [string]$market.privateKey

    if ([string]::IsNullOrWhiteSpace($country) -or [string]::IsNullOrWhiteSpace($privateKey) -or $privateKey -like "PASTE_*") {
      throw "Each market needs a country and a real privateKey in klaviyo-config.json."
    }

    $marketCodes += $country
    $headers = New-KlaviyoHeaders -PrivateKey $privateKey
    $jsonHeaders = New-KlaviyoHeaders -PrivateKey $privateKey -Json
    $conversionMetricId = Get-MetricIdByName -Headers $headers -MetricName "Placed Order"

    $campaignUri = "https://a.klaviyo.com/api/campaigns/?filter=and(equals(messages.channel,'email'),equals(status,'Sent'))&fields[campaign]=name,status,send_time,created_at,updated_at&page[size]=100&sort=-updated_at"
    $campaigns = Get-KlaviyoPages -Uri $campaignUri -Headers $headers

    foreach ($campaign in $campaigns) {
      $attributes = $campaign.attributes
      if (-not $attributes) { continue }

      $campaignName = [string]$attributes.name
      if ([string]::IsNullOrWhiteSpace($campaignName)) { continue }

      $sendTimeValue = if ($attributes.send_time) { [string]$attributes.send_time } elseif ($attributes.updated_at) { [string]$attributes.updated_at } else { [string]$attributes.created_at }
      if ([string]::IsNullOrWhiteSpace($sendTimeValue)) { continue }

      $sendTime = [DateTime]::Parse($sendTimeValue)
      if ($sendTime -lt $fromDate) { continue }

      $report = Query-CampaignValues -Headers $jsonHeaders -CampaignId ([string]$campaign.id) -ConversionMetricId $conversionMetricId
      $sent = [double](Get-ReportValue -Report $report -Name "recipients")
      $openRate = [double](Get-ReportValue -Report $report -Name "open_rate")
      $clickRate = [double](Get-ReportValue -Report $report -Name "click_rate")
      $unsubRate = [double](Get-ReportValue -Report $report -Name "unsubscribe_rate")
      $revenue = [double](Get-ReportValue -Report $report -Name "conversion_value")

      if (-not $groupMap.ContainsKey($campaignName)) {
        $groupMap[$campaignName] = [ordered]@{
          campaignName = $campaignName
          lastSent = $sendTime.ToUniversalTime().ToString("o")
          markets = @()
        }
      }

      $groupEntry = $groupMap[$campaignName]
      if ([DateTime]::Parse($groupEntry.lastSent) -lt $sendTime.ToUniversalTime()) {
        $groupEntry.lastSent = $sendTime.ToUniversalTime().ToString("o")
      }

      $groupEntry.markets += [PSCustomObject]@{
        country = $country
        sent = [math]::Round($sent, 0)
        openRate = [math]::Round($openRate, 2)
        clickRate = [math]::Round($clickRate, 2)
        revenue = [math]::Round($revenue, 2)
        unsubRate = [math]::Round($unsubRate, 2)
        sendTime = $sendTime.ToUniversalTime().ToString("o")
        status = "sent"
      }
    }
  }

  $campaignGroups = @()
  foreach ($entry in $groupMap.GetEnumerator()) {
    $marketsForGroup = @($entry.Value.markets | Sort-Object country)
    $sentTotal = ($marketsForGroup | Measure-Object -Property sent -Sum).Sum
    if (-not $sentTotal) { $sentTotal = 0 }
    $revenueTotal = ($marketsForGroup | Measure-Object -Property revenue -Sum).Sum
    $weightedOpen = if ($sentTotal -gt 0) { (($marketsForGroup | ForEach-Object { $_.openRate * $_.sent } | Measure-Object -Sum).Sum) / $sentTotal } else { 0 }
    $weightedClick = if ($sentTotal -gt 0) { (($marketsForGroup | ForEach-Object { $_.clickRate * $_.sent } | Measure-Object -Sum).Sum) / $sentTotal } else { 0 }
    $weightedUnsub = if ($sentTotal -gt 0) { (($marketsForGroup | ForEach-Object { $_.unsubRate * $_.sent } | Measure-Object -Sum).Sum) / $sentTotal } else { 0 }
    $presentMarkets = @($marketsForGroup.country)
    $missingMarkets = @($marketCodes | Where-Object { $presentMarkets -notcontains $_ })

    $lowestOpenMarket = $marketsForGroup | Sort-Object openRate | Select-Object -First 1
    $topRevenueMarket = $marketsForGroup | Sort-Object revenue -Descending | Select-Object -First 1
    $summary = if ($missingMarkets.Count -gt 0) {
      "Missing markets: $($missingMarkets -join ', '). Top revenue market: $($topRevenueMarket.country). Lowest open rate: $($lowestOpenMarket.country)."
    } else {
      "All configured markets sent this campaign. Top revenue market: $($topRevenueMarket.country). Lowest open rate: $($lowestOpenMarket.country)."
    }

    $campaignGroups += [PSCustomObject]@{
      campaignName = $entry.Value.campaignName
      lastSent = $entry.Value.lastSent
      aiSummary = $summary
      sentTotal = [math]::Round($sentTotal, 0)
      revenueTotal = [math]::Round($revenueTotal, 2)
      openRateWeighted = [math]::Round($weightedOpen, 2)
      clickRateWeighted = [math]::Round($weightedClick, 2)
      unsubRateWeighted = [math]::Round($weightedUnsub, 2)
      activeMarkets = $marketsForGroup.Count
      missingMarkets = @($missingMarkets)
      markets = $marketsForGroup
    }
  }

  $campaignGroups = @($campaignGroups | Sort-Object {[DateTime]::Parse($_.lastSent)} -Descending)
  $insightCards = New-InsightCards -CampaignGroups $campaignGroups -AllMarkets $marketCodes

  $payload = [PSCustomObject]@{
    generatedAt = $now.ToUniversalTime().ToString("o")
    timeframeDays = $timeframeDays
    markets = @($marketCodes | Sort-Object -Unique)
    campaignGroups = $campaignGroups
    insightCards = $insightCards
  }

  $payload | ConvertTo-Json -Depth 20 | Set-Content -Path $outputJsonPath -Encoding UTF8
  (ConvertTo-JavaScriptModule -Payload $payload) | Set-Content -Path $outputModulePath -Encoding UTF8

  Write-Host "Klaviyo sync completed."
  Write-Host "Saved live snapshot to $outputJsonPath"
  Write-Host "Saved JS module to $outputModulePath"
}
catch {
  Write-Error $_.Exception.Message
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  exit 1
}
