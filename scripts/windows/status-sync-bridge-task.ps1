<#
.SYNOPSIS
  Shows Windows scheduled task state and WSL bridge process/log status.
#>

[CmdletBinding()]
param(
  [string]$TaskName = 'Mission Control Online Sync Bridge',
  [string]$Distro = $env:MCO_WSL_DISTRO,
  [string]$LinuxRepoPath = '/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online',
  [string]$LogFile = '/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online/logs/sync-bridge-task.log'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  [PSCustomObject]@{
    TaskName      = $task.TaskName
    State         = $task.State
    LastRunTime   = $info.LastRunTime
    LastTaskResult = $info.LastTaskResult
    NextRunTime   = $info.NextRunTime
  } | Format-List
} else {
  Write-Host "Scheduled task '$TaskName' is not registered."
}

$wslArgs = @()
if ($Distro -and $Distro.Trim().Length -gt 0) {
  $wslArgs += @('-d', $Distro.Trim())
}
if ($LinuxRepoPath.Contains("'") -or $LogFile.Contains("'")) {
  throw 'LinuxRepoPath and LogFile cannot contain single quotes.'
}

$bashCommand = "repo='$LinuxRepoPath'; log='$LogFile'; cd `"`$repo`" && echo '--- bridge process ---' && (pgrep -af 'tsx scripts/sync-bridge.ts' || true) && echo '--- latest log ---' && (tail -n 40 `"`$log`" 2>/dev/null || echo 'No task log yet.')"
$wslArgs += @('--', 'bash', '-lc', $bashCommand)

& wsl.exe @wslArgs
