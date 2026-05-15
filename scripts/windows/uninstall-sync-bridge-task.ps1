<#
.SYNOPSIS
  Removes the Mission Control Online Windows scheduled task.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$TaskName = 'Mission Control Online Sync Bridge'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "Scheduled task '$TaskName' is not registered."
  exit 0
}

if ($PSCmdlet.ShouldProcess($TaskName, 'Stop and unregister scheduled task')) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Write-Host "Removed scheduled task '$TaskName'. If the WSL bridge is still running, stop it with: pkill -f 'tsx scripts/sync-bridge.ts'"
