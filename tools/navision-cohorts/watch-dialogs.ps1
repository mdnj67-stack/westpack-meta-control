# Watches the Excel instance started by run-nav-report.ps1 for message boxes.
# An information box is acknowledged with its OK button. Anything that asks for a login or
# password is left alone and the watcher stops, so the person at the PC can decide.
param([Parameter(Mandatory)][string]$Tag, [int]$TimeoutSec = 1200)
$base = if ($env:NAV_COHORT_DIR) { $env:NAV_COHORT_DIR } else { Join-Path $PSScriptRoot '..\..\tmp\navision-cohorts' }
$work = Join-Path $base 'data\nav-runs'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
if (-not ('Win32Dlg' -as [type])) {
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class Win32Dlg { [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'
}
$A = [System.Windows.Automation.AutomationElement]
$T = [System.Windows.Automation.TreeScope]
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$myPid = $null
while ((Get-Date) -lt $deadline) {
  if (Test-Path "$work\$Tag.done") { "DONE: " + (Get-Content "$work\$Tag.done"); exit 0 }
  if (Test-Path "$work\$Tag.err") { "ERROR: " + (Get-Content "$work\$Tag.err"); exit 1 }
  if (-not $myPid -and (Test-Path "$work\$Tag.pid")) { $myPid = [int](Get-Content "$work\$Tag.pid") }
  if ($myPid) {
    $cond = New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $myPid)
    foreach ($w in $A::RootElement.FindAll($T::Children, $cond)) {
      $dialogs = @($w) + @($w.FindAll($T::Children, [System.Windows.Automation.Condition]::TrueCondition))
      foreach ($d in $dialogs) {
        if ($d.Current.ClassName -ne '#32770') { continue }
        $texts = @($d.FindAll($T::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name } | Where-Object { $_ })
        $all = ($texts -join ' | ')
        if ($all -match '(?i)login|logon|password|adgangskode|bruger|user ?name|credential|legitimation') {
          "LOGIN DIALOG - not touched. Text: $all"; exit 2
        }
        # A VBA MsgBox: click its OK button through the button's own window (BM_CLICK).
        $btn = $null
        foreach ($e in $d.FindAll($T::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
          if ($e.Current.Name -match '^(OK|Ok)$' -and $e.Current.NativeWindowHandle -ne 0) { $btn = $e; break }
        }
        if ($btn) {
          if ($script:acked -ne $all) { "Acknowledged dialog: $all"; $script:acked = $all }
          [void][Win32Dlg]::SetForegroundWindow([IntPtr]$d.Current.NativeWindowHandle)
          [void][Win32Dlg]::SendMessage([IntPtr]$btn.Current.NativeWindowHandle, 0x00F5, [IntPtr]0, [IntPtr]0)
        } else { "Dialog without OK button (left alone): $all"; exit 3 }
      }
    }
  }
  Start-Sleep -Seconds 2
}
"TIMEOUT after $TimeoutSec s"; exit 4
