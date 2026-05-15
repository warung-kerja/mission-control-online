<#
.SYNOPSIS
  Starts the Mission Control Online sync bridge inside WSL.
#>

[CmdletBinding()]
param(
  [string]$Distro = $env:MCO_WSL_DISTRO,
  [string]$LinuxRepoPath = '/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online',
  [string]$LogFile = '/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online/logs/sync-bridge-task.log'
)

$ErrorActionPreference = 'Stop'

# Write the bash script through WSL to avoid PS interpolation of $() and $$
Write-Host "Starting Mission Control Online sync bridge via WSL..."

$wslDistroArg = @()
if ($Distro -and $Distro.Trim().Length -gt 0) {
  $wslDistroArg = @('-d', $Distro.Trim())
}

# Step 1: Create the WSL directory
& wsl.exe @wslDistroArg -- bash -c "mkdir -p /tmp/mco-bridge"

# Step 2: Write the bash script line by line to avoid any PS expansion
$lines = @(
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  "REPO='$LinuxRepoPath'",
  "LOG='$LogFile'",
  'mkdir -p "$(dirname "$LOG")"',
  'printf ''\n[%s] Task Scheduler bridge starting (PID %s)\n'' "$(date -Is)" "$$" >> "$LOG"',
  'cd "$REPO"',
  'exec npm run sync:poll >> "$LOG" 2>&1'
)

foreach ($line in $lines) {
  # Use base64 to pass the line safely through wsl.exe
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($line + "`n")
  $b64 = [System.Convert]::ToBase64String($bytes)
  & wsl.exe @wslDistroArg -- bash -c "echo $b64 | base64 -d >> /tmp/mco-bridge/start-bridge.sh"
}

# Step 3: Make executable + run
& wsl.exe @wslDistroArg -- bash -c "chmod +x /tmp/mco-bridge/start-bridge.sh && exec /tmp/mco-bridge/start-bridge.sh"
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Error "Mission Control Online sync bridge exited with code $exitCode. See WSL log: $LogFile"
  exit $exitCode
}
