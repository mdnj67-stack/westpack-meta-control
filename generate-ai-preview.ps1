param(
  [string]$SourceAdId = "",
  [string]$TargetCampaign = "",
  [string]$TargetLanguage = "English",
  [string]$OperatorNote = ""
)

$secretsPath = Join-Path $PSScriptRoot "secrets\secrets..txt"
$metaPath = Join-Path $PSScriptRoot "data\meta-live.js"
$outputPath = Join-Path $PSScriptRoot "data\ai-preview.js"

if (-not (Test-Path $secretsPath)) {
  Write-Error "Missing secrets file at $secretsPath"
  exit 1
}

if (-not (Test-Path $metaPath)) {
  Write-Error "Missing live Meta snapshot at $metaPath. Run sync-meta.ps1 first."
  exit 1
}

$secrets = Get-Content $secretsPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($secrets.openaiApiKey)) {
  Write-Error "openaiApiKey missing in secrets file."
  exit 1
}

$metaRaw = Get-Content $metaPath -Raw
$metaJson = $metaRaw -replace '^const metaLiveSnapshot =\s*', '' -replace '\s*export default metaLiveSnapshot;\s*$', ''
$meta = $metaJson | ConvertFrom-Json

$sourceAd = if ($SourceAdId) {
  $meta.ads | Where-Object { $_.id -eq $SourceAdId } | Select-Object -First 1
} else {
  $meta.ads | Select-Object -First 1
}

if (-not $sourceAd) {
  Write-Error "No source ad found."
  exit 1
}

$targetCampaignName = if ($TargetCampaign) { $TargetCampaign } elseif ($meta.campaigns.Count -gt 0) { $meta.campaigns[0].name } else { "Target campaign" }

$systemPrompt = @"
You are a Westpack-specific Meta ad specialist.
Return valid JSON only.
Create a localized clone draft for a Meta ad.
Keep the output in English UI wording but adapt ad copy to the requested target language.
Prioritize B2B retail buyers, premium packaging, perceived value, and strong Meta ad clarity.
Output JSON with:
- primaryText
- headline
- description
- rationale
- variants: array of 3 objects with title, body, headline, angle
"@

$userPrompt = @"
Source ad name: $($sourceAd.name)
Source campaign: $($sourceAd.campaign)
Source headline/creative label: $($sourceAd.headline)
Source placeholder text: $($sourceAd.primary)
Target campaign: $targetCampaignName
Target language: $TargetLanguage
Operator note: $OperatorNote

Generate a clone-and-translate draft for Westpack.
"@

$body = @{
  model = "gpt-4.1-mini"
  response_format = @{ type = "json_object" }
  messages = @(
    @{ role = "system"; content = $systemPrompt },
    @{ role = "user"; content = $userPrompt }
  )
} | ConvertTo-Json -Depth 8

$headers = @{
  Authorization = "Bearer $($secrets.openaiApiKey)"
  "Content-Type" = "application/json"
}

try {
  $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" -Method Post -Headers $headers -Body $body
  $content = $response.choices[0].message.content
  $parsed = $content | ConvertFrom-Json

  $payload = [PSCustomObject]@{
    source = $sourceAd.name
    targetCampaign = $targetCampaignName
    targetLanguage = $TargetLanguage
    primaryText = $parsed.primaryText
    headline = $parsed.headline
    description = $parsed.description
    rationale = $parsed.rationale
    variants = $parsed.variants
    generatedAt = (Get-Date).ToString("s")
  }

  $json = $payload | ConvertTo-Json -Depth 8
  $module = "const aiPreviewSnapshot = $json`r`n`r`nexport default aiPreviewSnapshot;`r`n"
  Set-Content -Path $outputPath -Value $module -Encoding UTF8
  Write-Host "AI preview generated and saved to $outputPath"
}
catch {
  Write-Error $_.Exception.Message
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  exit 1
}
