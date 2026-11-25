# Registers (or replaces) the Task Scheduler task that sends this computer's calendar and mail to the morning brief:
# weekdays from 06:00 every 20 minutes until noon, and at log-on. Missed runs start when the computer wakes
# (StartWhenAvailable). scripts\morning-brief-local.ps1 does nothing once today's has been sent, so only the first
# run after the computer wakes does any work. Runs as the logged-on user, because Outlook's COM object needs the
# user's own session.
#
# powershell -ExecutionPolicy Bypass -File scripts\register-morning-brief-task.ps1
$name = "Westpack Morgenbrief - kalender og mail"
$script = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\morning-brief-local.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""

$morning = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At 06:00
$repeat = New-ScheduledTaskTrigger -Once -At 06:00 -RepetitionInterval (New-TimeSpan -Minutes 20) -RepetitionDuration (New-TimeSpan -Hours 6)
$morning.Repetition = $repeat.Repetition
$logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $morning, $logon -Settings $settings -Principal $principal -Description "Sends today's calendar and the mail that needs you from Outlook to the morning brief in biblen (Agents -> Morning brief). Read-only towards Outlook; HR and candidate mail is never sent." -Force | Out-Null
Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
