<#
.SYNOPSIS
  Registers the Mission Control Online WSL sync bridge as a Windows scheduled task.

.DESCRIPTION
  Creates a least-privilege per-user task that starts at Windows logon and runs
  scripts/windows/start-sync-bridge.ps1. It does not store secrets in Task
  Scheduler; the bridge reads local WSL .env.sync at runtime.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$TaskName = 'Mission Control Online Sync Bridge',
  [string]$Distro = $env:MCO_WSL_DISTRO,
  [switch]$StartNow,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $ScriptDir 'start-sync-bridge.ps1'

if (-not (Test-Path $StartScript)) {
  throw "Start script not found: $StartScript"
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask -and -not $Force) {
  throw "Scheduled task '$TaskName' already exists. Re-run with -Force to replace it."
}

if ($existingTask -and $Force) {
  if ($PSCmdlet.ShouldProcess($TaskName, 'Unregister existing scheduled task')) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }
}

$argumentParts = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', "`"$StartScript`""
)

if ($Distro -and $Distro.Trim().Length -gt 0) {
  $argumentParts += @('-Distro', "`"$($Distro.Trim())`"")
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($argumentParts -join ' ')
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

if ($PSCmdlet.ShouldProcess($TaskName, 'Register scheduled task')) {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Runs the Mission Control Online Supabase sync bridge in WSL at Windows logon.' | Out-Null
}

if ($StartNow) {
  if ($PSCmdlet.ShouldProcess($TaskName, 'Start scheduled task now')) {
    Start-ScheduledTask -TaskName $TaskName
  }
}

$registeredTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($registeredTask) {
  $registeredTask | Format-List TaskName, State, TaskPath
} else {
  Write-Host "Scheduled task '$TaskName' was not registered."
}
