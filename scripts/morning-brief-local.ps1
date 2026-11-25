# The morning brief's local part: reads today's calendar and the mail that needs the user from this computer's
# Outlook and sends it to the morning brief in biblen (Agents -> Morning brief), which then writes the day's to-dos.
#
# Read-only towards Outlook: nothing is opened in the UI, moved, marked as read or answered, and no attachment is
# read. Mail about recruitment (ansøgning, ansøger, kandidat, CV, jobsamtale, trainee ...) is never sent: it is held
# back and only counted, and a meeting about it is sent as "Rekruttering" without its name. Private appointments are
# sent as "Privat aftale". Newsletters and automatic mail are left out by their headers.
#
# Runs from Task Scheduler ("Westpack Morgenbrief - kalender og mail", scripts\register-morning-brief-task.ps1):
# weekdays from 06:00 every 20 minutes and at log-on; it does nothing once today's has been sent, so the first run
# after the computer wakes is the one that counts.
#
# Manual: powershell -ExecutionPolicy Bypass -File scripts\morning-brief-local.ps1 [-Force] [-DryRun]
#   -Force   run on a weekend or again today
#   -DryRun  read Outlook and print what would be sent; send nothing
#   -SinceHours 240  read the inbox further back than the last brief (for a test)
param(
  [switch]$Force,
  [switch]$DryRun,
  [int]$SinceHours = 0,
  [string]$Base = "https://project-4fcxa.vercel.app"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "tmp\morning-brief"
New-Item -ItemType Directory -Force $dir | Out-Null
$log = Join-Path $dir "run.log"
function Write-Log([string]$text) { "$(Get-Date -Format s) $text" | Out-File $log -Append -Encoding utf8 }

$now = Get-Date
$today = $now.ToString("yyyy-MM-dd")
$marker = Join-Path $dir "sent-$today.txt"
if (-not $Force -and -not $DryRun) {
  if ($now.DayOfWeek -eq [DayOfWeek]::Saturday -or $now.DayOfWeek -eq [DayOfWeek]::Sunday) { exit 0 }
  if (Test-Path $marker) { exit 0 }
  if ($now.Hour -lt 5) { exit 0 }
}

# Written with \u escapes so the patterns survive Windows PowerShell reading this file in the ANSI code page.
# ansøg = ansøg, ansættelse = ansættelse.
$hrPattern = '(?i)ans(ø|o|oe)g|kandidat|\bcv\b|curriculum|rekrutt|recruit|jobsamtale|ansættelsessamtale|praktikant|trainee|job ?application|applicant|stillingsopslag|jobopslag|ledig stilling|interview'
$bulkSenderPattern = '(?i)no-?reply|do-?not-?reply|newsletter|nyhedsbrev|notification|mailer-daemon|postmaster'
$bulkHeaderPattern = '(?im)^(list-unsubscribe|list-id):|^precedence:\s*(bulk|list|junk)|^auto-submitted:\s*auto-'
$heldBackHr = 0
$heldBackBulk = 0

try {
  $outlook = New-Object -ComObject Outlook.Application
  $ns = $outlook.GetNamespace("MAPI")
} catch {
  Write-Log "Outlook could not be opened: $($_.Exception.Message)"
  exit 1
}

$myName = [string]$ns.CurrentUser.Name
$myAddress = ""
try { $myAddress = [string]$ns.CurrentUser.AddressEntry.GetExchangeUser().PrimarySmtpAddress } catch { }

function Get-Text($value, [int]$max) {
  $text = ([string]$value) -replace '\s+', ' '
  $text = $text.Trim()
  if ($text.Length -gt $max) { $text = $text.Substring(0, $max) }
  return $text
}

function Get-Sender($mail) {
  $address = ""
  try {
    if ($mail.SenderEmailType -eq "EX") { $address = [string]$mail.Sender.GetExchangeUser().PrimarySmtpAddress }
    else { $address = [string]$mail.SenderEmailAddress }
  } catch { $address = [string]$mail.SenderEmailAddress }
  return $address
}

# The mail's own words, without the quoted thread under them.
function Get-Snippet($mail) {
  $body = [string]$mail.Body
  if ($body.Length -gt 6000) { $body = $body.Substring(0, 6000) }
  $cut = [regex]::Match($body, '(?im)^\s*(from|fra|sent|sendt|-----original|-----oprindelig)[: ]|^\s*on .{5,80} wrote:|^\s*den .{5,80} skrev')
  if ($cut.Success -and $cut.Index -gt 20) { $body = $body.Substring(0, $cut.Index) }
  return Get-Text $body 600
}

# ---------------------------------------------------------------------------------------------
# Calendar: today and the next two days (Friday: through Monday). Titles, times, places; never bodies.

$calendar = New-Object System.Collections.ArrayList
$from = $now.Date
$to = $now.Date.AddDays(3)
if ($now.DayOfWeek -eq [DayOfWeek]::Friday) { $to = $now.Date.AddDays(4) }
$items = $ns.GetDefaultFolder(9).Items
$items.IncludeRecurrences = $true
$items.Sort("[Start]")
$restricted = $items.Restrict("[Start] >= '" + $from.ToString("g") + "' AND [Start] < '" + $to.ToString("g") + "'")
$appointment = $restricted.GetFirst()
$guard = 0
while ($null -ne $appointment -and $guard -lt 200) {
  $guard++
  try {
    $status = [int]$appointment.MeetingStatus
    $response = [int]$appointment.ResponseStatus
    if ($status -ne 5 -and $status -ne 7 -and $response -ne 4) {
      $subject = [string]$appointment.Subject
      $location = [string]$appointment.Location
      $organizer = [string]$appointment.Organizer
      if ([int]$appointment.Sensitivity -eq 2) { $subject = "Privat aftale"; $location = ""; $organizer = "" }
      elseif ($subject -match $hrPattern) { $subject = "Rekruttering"; $location = ""; $organizer = "" }
      $responseText = switch ($response) { 1 { "arrangør" } 2 { "foreløbig" } 3 { "accepteret" } 5 { "ikke svaret" } default { "" } }
      [void]$calendar.Add([ordered]@{
        id = "$($appointment.EntryID)|$($appointment.Start.ToString('s'))"
        start = $appointment.Start.ToString("yyyy-MM-ddTHH:mm")
        end = $appointment.End.ToString("yyyy-MM-ddTHH:mm")
        allDay = [bool]$appointment.AllDayEvent
        subject = Get-Text $subject 160
        location = Get-Text $location 120
        organizer = Get-Text $organizer 80
        organizedByMe = ($organizer -eq $myName)
        response = $responseText
      })
    }
  } catch { }
  if ($calendar.Count -ge 30) { break }
  $appointment = $restricted.GetNext()
}

# ---------------------------------------------------------------------------------------------
# Mail: the inbox since the last brief (at most three days back), plus flagged mail still open.

$since = $now.AddHours(-24)
$previous = Get-ChildItem $dir -Filter "sent-*.txt" -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "sent-$today.txt" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($previous) { $since = $previous.LastWriteTime.AddHours(-1) }
if ($since -lt $now.AddHours(-72)) { $since = $now.AddHours(-72) }
if ($since -gt $now.AddHours(-20)) { $since = $now.AddHours(-20) }
if ($SinceHours -gt 0) { $since = $now.AddHours(-$SinceHours) }

$inbox = $ns.GetDefaultFolder(6)
$candidates = New-Object System.Collections.ArrayList
$recent = $inbox.Items
$recent.Sort("[ReceivedTime]", $true)
$recentHits = $recent.Restrict("[ReceivedTime] >= '" + $since.ToString("g") + "'")
foreach ($item in $recentHits) { [void]$candidates.Add($item); if ($candidates.Count -ge 150) { break } }
$flaggedHits = $inbox.Items.Restrict("[FlagStatus] = 2")
$flaggedCount = 0
foreach ($item in $flaggedHits) { [void]$candidates.Add($item); $flaggedCount++; if ($flaggedCount -ge 20) { break } }

$mail = New-Object System.Collections.ArrayList
$seenConversations = @{}
$seenIds = @{}
foreach ($m in $candidates) {
  try {
    if ([int]$m.Class -ne 43) { continue }
    $entryId = [string]$m.EntryID
    if ($seenIds.ContainsKey($entryId)) { continue }
    $seenIds[$entryId] = $true

    $senderAddress = Get-Sender $m
    if ($myAddress -and $senderAddress -eq $myAddress) { continue }
    $subject = [string]$m.Subject
    $snippet = Get-Snippet $m
    $attachmentNames = ""
    try { foreach ($a in $m.Attachments) { $attachmentNames += " " + [string]$a.FileName } } catch { }
    if (($subject + " " + $snippet + " " + $attachmentNames) -match $hrPattern) { $heldBackHr++; continue }

    $headers = ""
    try { $headers = [string]$m.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x007D001F") } catch { }
    if ($senderAddress -match $bulkSenderPattern -or $headers -match $bulkHeaderPattern) { $heldBackBulk++; continue }

    $flagged = ([int]$m.FlagStatus -eq 2)
    $unread = [bool]$m.UnRead
    $important = ([int]$m.Importance -eq 2)
    $toMe = ([string]$m.To) -match [regex]::Escape($myName)
    if (-not $toMe -and -not $flagged -and -not $unread -and -not $important) { continue }

    # One mail per thread: the newest (the list is newest first, flagged mail after).
    $conversation = [string]$m.ConversationID
    if ($conversation -and $seenConversations.ContainsKey($conversation) -and -not $flagged) { continue }
    if ($conversation) { $seenConversations[$conversation] = $true }

    $domain = ""
    if ($senderAddress -match '@(.+)$') { $domain = $Matches[1].ToLower() }
    $fromLabel = [string]$m.SenderName
    if ($domain -and $domain -ne "westpack.com" -and $domain -ne "westpack.dk") { $fromLabel = "$fromLabel ($domain)" }

    [void]$mail.Add([ordered]@{
      id = $entryId
      received = $m.ReceivedTime.ToString("yyyy-MM-ddTHH:mm")
      from = Get-Text $fromLabel 100
      subject = Get-Text $subject 200
      snippet = $snippet
      unread = $unread
      flagged = $flagged
      important = $important
      toMe = $toMe
      attachments = [int]$m.Attachments.Count
    })
    if ($mail.Count -ge 40) { break }
  } catch { }
}

$payload = [ordered]@{
  readAt = (Get-Date).ToString("o")
  calendar = $calendar
  mail = $mail
  heldBack = [ordered]@{ hr = $heldBackHr; bulk = $heldBackBulk }
}
$out = Join-Path $dir "outlook-$today.json"
[System.IO.File]::WriteAllText($out, ($payload | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
Write-Log "Read $($calendar.Count) appointments and $($mail.Count) mails since $($since.ToString('s')); held back $heldBackHr HR, $heldBackBulk bulk."

if ($DryRun) {
  "Kalender: $($calendar.Count)"
  foreach ($c in $calendar) { "  $($c.start) $($c.subject)" }
  "Mail: $($mail.Count) (holdt tilbage: $heldBackHr HR/kandidat, $heldBackBulk nyhedsbreve/automatisk)"
  foreach ($x in $mail) { "  $($x.received) $($x.from): $($x.subject)$(if ($x.flagged) { ' [markeret]' })$(if ($x.unread) { ' [ulæst]' })" }
  "Skrevet til $out - intet sendt."
  exit 0
}

Push-Location $root
try {
  $output = & node "scripts\morning-brief-local.js" $out "--base=$Base" 2>&1 | ForEach-Object { "$_" }
  $exit = $LASTEXITCODE
} finally {
  Pop-Location
}
$output | ForEach-Object { Write-Log $_ }
# The mail snippets have reached biblen's private store; the local copy is not kept.
Remove-Item $out -ErrorAction SilentlyContinue
if ($exit -eq 0) {
  (Get-Date -Format s) | Out-File $marker -Encoding utf8
  Get-ChildItem $dir -Filter "sent-*.txt" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -ErrorAction SilentlyContinue
} else {
  Write-Log "Not sent (exit $exit); the next scheduled run tries again."
}
exit $exit
