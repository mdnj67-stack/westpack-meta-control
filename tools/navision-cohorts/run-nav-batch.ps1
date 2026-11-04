# Runs the Navision report for each cut-off in turn (never two at once), watching each run's dialog.
param([string[]]$Cutoffs, [string]$From = '2019-05-01')
$scripts = $PSScriptRoot
foreach ($to in $Cutoffs) {
  $tag = 'c' + ($to -replace '-', '')
  "== $From -> $to ($tag)"
  $p = Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$scripts\run-nav-report.ps1", '-From', $From, '-To', $to, '-Tag', $tag) -PassThru -WindowStyle Hidden
  & "$scripts\watch-dialogs.ps1" -Tag $tag -TimeoutSec 900
  $p.WaitForExit()
}
