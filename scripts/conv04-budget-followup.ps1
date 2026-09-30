# Builds the Conv - 04 budget follow-up report and mails it through the local Outlook profile.
# Scheduled once via Windows Task Scheduler (task "Westpack Conv04 follow-up"). Needs the PC on
# and Outlook's profile available; the Meta token never leaves this machine.
# Manual run: powershell -ExecutionPolicy Bypass -File scripts\conv04-budget-followup.ps1 [-To someone@westpack.com]
param([string]$To = "mdj@westpack.com")

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "tmp\conv04-followup"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir "run.log"
"$(Get-Date -Format s) start" | Out-File $log -Append -Encoding utf8

Push-Location $root
try {
  $output = & node "scripts\conv04-budget-followup.js" 2>&1 | ForEach-Object { "$_" }
  $exit = $LASTEXITCODE
} finally {
  Pop-Location
}
$output | Out-File $log -Append -Encoding utf8

$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
$mail.To = $To

if ($exit -eq 0) {
  $reportPath = $output | Where-Object { $_ -like "*.html" } | Select-Object -First 1
  $subject = ($output | Where-Object { $_ -like "SUBJECT:*" } | Select-Object -First 1) -replace "^SUBJECT:", ""
  $mail.Subject = $subject
  $mail.HTMLBody = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
} else {
  $mail.Subject = "Conv - 04 opfølgning kunne ikke laves"
  $mail.Body = "Scriptet scripts/conv04-budget-followup.js fejlede:`r`n`r`n$($output -join "`r`n")`r`n`r`nKør det manuelt fra C:\Projects\westpack-meta-control."
}

$mail.Send()
"$(Get-Date -Format s) sent to $To (exit $exit)" | Out-File $log -Append -Encoding utf8
