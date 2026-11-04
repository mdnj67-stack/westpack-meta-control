# Runs ast's "Opdater fra Navision" on a COPY of the workbook for a custom period and exports the
# Kunder table's raw values to CSV. Uses only the workbook's own button macro.
# Usage: run-nav-report.ps1 -From 2019-05-01 -To 2020-04-30 -Tag c20200430
# The person running it needs the workbook's stored SQL login (the workbook asks once, the first time).
param([Parameter(Mandatory)][string]$From, [Parameter(Mandatory)][string]$To, [Parameter(Mandatory)][string]$Tag,
  [string]$Workbook = "$env:USERPROFILE\Downloads\Nye_kunder_SQL_login.xlsm")
$ErrorActionPreference = 'Stop'
$base = if ($env:NAV_COHORT_DIR) { $env:NAV_COHORT_DIR } else { Join-Path $PSScriptRoot '..\..\tmp\navision-cohorts' }
$work = Join-Path $base 'data\nav-runs'
New-Item -ItemType Directory -Force $work | Out-Null
$copy = "$work\Nye_kunder_SQL_login_copy.xlsm"
if (-not (Test-Path $copy)) {
  # Copy without locking: the original is often open in Excel.
  $in = [System.IO.File]::Open($Workbook, 'Open', 'Read', 'ReadWrite')
  $out = [System.IO.File]::Create($copy); $in.CopyTo($out); $out.Close(); $in.Close()
}
foreach ($f in "$work\$Tag.done", "$work\$Tag.err", "$work\$Tag.pid") { Remove-Item $f -ErrorAction SilentlyContinue }
$before = @(Get-Process EXCEL -ErrorAction SilentlyContinue | ForEach-Object Id)
$xl = New-Object -ComObject Excel.Application
$myPid = (Get-Process EXCEL | Where-Object { $before -notcontains $_.Id } | Select-Object -First 1).Id
Set-Content "$work\$Tag.pid" $myPid
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
  $xl.Visible = $true
  $xl.DisplayAlerts = $false
  $wb = $xl.Workbooks.Open($copy)
  $ws = $wb.Worksheets.Item("Oversigt")
  $ws.Range("B4").Value2 = "Valgfri periode"
  $ws.Range("B5").Value2 = ([datetime]::ParseExact($From, 'yyyy-MM-dd', $null)).ToOADate()
  $ws.Range("D5").Value2 = ([datetime]::ParseExact($To, 'yyyy-MM-dd', $null)).ToOADate()
  $xl.Calculation = -4135   # manual while the macro writes rows
  [void]$xl.Run("OpdaterFraNavision")
  $runSec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  $k = $wb.Worksheets.Item("Kunder")
  $last = $k.Cells.Item($k.Rows.Count, 1).End(-4162).Row   # xlUp
  $vals = $k.Range("A5:Z$last").Value2
  $rows = $vals.GetLength(0); $cols = $vals.GetLength(1)
  $inv = [Globalization.CultureInfo]::InvariantCulture
  $sb = New-Object System.Text.StringBuilder
  for ($r = 1; $r -le $rows; $r++) {
    $cells = New-Object string[] $cols
    for ($c = 1; $c -le $cols; $c++) {
      $v = $vals[$r, $c]
      if ($null -eq $v) { $cells[$c - 1] = '' }
      elseif ($v -is [double]) { $cells[$c - 1] = $v.ToString('R', $inv) }
      else { $cells[$c - 1] = '"' + ("$v" -replace '"', '""') + '"' }
    }
    [void]$sb.AppendLine(($cells -join ','))
  }
  [IO.File]::WriteAllText("$work\$Tag-kunder.csv", $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
  Set-Content "$work\$Tag.done" ("rows={0} macroSeconds={1} totalSeconds={2}" -f ($rows - 1), $runSec, [math]::Round($sw.Elapsed.TotalSeconds, 1))
} catch {
  Set-Content "$work\$Tag.err" $_.Exception.Message
  throw
} finally {
  try { $wb.Close($false) } catch {}
  $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
