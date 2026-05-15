# Windows Task Scheduler Bridge — Mission Control Online

This wrapper keeps the local Supabase sync bridge running after Windows sign-in.

## What gets created

- Windows scheduled task: `Mission Control Online Sync Bridge`
- Trigger: current Windows user logon
- Action: run `scripts/windows/start-sync-bridge.ps1`
- Runtime: WSL `npm run sync:poll`
- Log file: `logs/sync-bridge-task.log` (gitignored)

The task does **not** store Supabase keys or OpenClaw tokens. Secrets remain in local WSL `.env.sync` and are loaded by `scripts/sync-bridge.ts`.

## Install / replace

Run from Windows PowerShell in the repo root:

```powershell
.\scripts\windows\install-sync-bridge-task.ps1 -Force -StartNow
```

If the default WSL distro is not the one with this repo/node setup, pass it explicitly:

```powershell
.\scripts\windows\install-sync-bridge-task.ps1 -Force -StartNow -Distro "Ubuntu"
```

## Check status

```powershell
.\scripts\windows\status-sync-bridge-task.ps1
```

From WSL, you can also check:

```bash
pgrep -af "tsx scripts/sync-bridge.ts" || echo "Bridge is not running"
tail -n 80 logs/sync-bridge-task.log
npm run supabase:verify
```

## Stop / rollback

Remove the Windows scheduled task:

```powershell
.\scripts\windows\uninstall-sync-bridge-task.ps1
```

If the WSL bridge process is still running, stop it from WSL:

```bash
pkill -f "tsx scripts/sync-bridge.ts" || true
rm -f /tmp/mission-control-online-sync-bridge.pid
```

## Safety notes

- The bridge has a WSL PID lock, so duplicate task launches should exit safely.
- The task runs least-privilege as the signed-in Windows user.
- The bridge keeps WSL active while it is running.
- Logs are local-only and ignored by git.
