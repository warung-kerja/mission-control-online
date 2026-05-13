# Agent Handoff - Mission Control Online

_Last updated: 2026-05-14 06:27 AEST_

## Read this first

This repo is the separate online/private mirror of Mission Control V3.

Do not treat this as the local Mission Control V3 repo.

## Project path

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online
```

## Local Mission Control V3 path - do not modify unless explicitly requested

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2
```

Reading local V3 for reference is acceptable when porting panels, but do not write to it from this repo.

## Required reading order

Before working:

1. `README.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/PRD.md`
4. `docs/EPICS.md`
5. `docs/PROJECT_TRACKER.md`
6. `docs/WORKLOG.md`
7. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md`

## Current user intent

Raz wants this repo to stay easy for Codex Desktop and other agents to continue. Every meaningful work session must update the master list, tracker, worklog, and this handoff when context changes.

Current priority is overnight continuation:

1. Continue V3 visual shell port: first shell/chrome slice is implemented; Jen follow-up audit remains queued as `MCO-039` when runtime is available.
2. Finish authenticated browser verification that production shows Cron Health, Workspace/Git, and the new shell after deployment. Static Vercel deployment was previously verified.
3. Keep bridge durability/reboot-proofing queued after the visual shell/panel-polish slice.
4. Reboot-proof bridge durability with Windows Task Scheduler or equivalent.
5. No V2 remote actions until Raz explicitly approves.

## Current technical state

V1 is complete and live as a private read-only Vercel + Supabase mirror.

Current online panels:

- Projects
- Team
- Source Health
- Sync history / Manual Refresh
- Cron Health shell from `cron_job_snapshots`
- Token Usage from `agent_token_usage_daily`
- Workspace/Git Signals from `workspace_signal_snapshots`

Important files:

- `package.json`
- `.env.example`
- `.env.local` - local only, do not commit
- `.env.sync` - local only, do not commit
- `src/App.tsx`
- `src/lib/supabase.ts`
- `src/types/supabase.ts`
- `src/styles.css`
- `scripts/sync-bridge.ts`
- `supabase/migrations/001_initial_private_mirror.sql`

## Current caveats

No TypeScript/build blocker is currently open. First V3-style online shell slice is implemented in `src/App.tsx` and `src/styles.css`.

Latest validation passed from WSL:

```bash
npm run type-check
npm run build
npm run supabase:verify
```

2026-05-14 static production check: Vercel returned HTTP 200 and served `assets/index-CT2apXsp.js`, matching the current local production build asset hash.

Current caveats:

- `cron_job_snapshots` plumbing and UI exist. The bridge now prefers local OpenClaw cron state files and successfully synced 61 real cron jobs. The gateway CLI path is still flaky because the gateway has event-loop delays, but Cron Health no longer depends on it for the normal sync path.
- `agent_token_usage_daily` plumbing and UI exist. Current Supabase count is 21 aggregate rows.
- `workspace_signal_snapshots` plumbing and UI exist. Current Supabase count is 1 snapshot row.
- The bridge is process-based and not reboot-proof. Windows Task Scheduler or equivalent is still V1.1 work.
- Run validation from WSL. The current `node_modules` native packages are Linux-flavored; Windows Node can type-check, but Vite/Rollup/esbuild native binaries fail from PowerShell.
- Authenticated visual verification of the new V3 shell on Vercel remains pending until after push/deploy.

## Supabase details

Project URL:

```text
https://mqvscznkgqoajirbkcrj.supabase.co
```

Publishable key is stored locally in `.env.local`.

Do not ask Raz to paste service-role keys or OpenClaw gateway tokens into chat. Use local `.env.sync` / secure local setup.

## Security rules

- Never commit `.env.local`, `.env.sync`, service-role keys, or gateway tokens.
- Never expose Supabase service-role key to Vercel/browser.
- V1 is read-only.
- Manual refresh should only request a sync, not execute arbitrary commands.
- Do not sync raw memories, transcripts, secrets, or gateway tokens.
- Do not add remote command execution or browser-triggered local actions until Raz explicitly approves V2 scope.

## Required work logging

After each meaningful task, update:

1. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` for milestone/status changes
2. `docs/PROJECT_TRACKER.md` for task state
3. `docs/WORKLOG.md` for execution evidence
4. This file if handoff context changes

Minimum record format:

```text
Date/time:
Agent:
Task ID:
Files changed:
Summary:
Validation:
Risks/blockers:
Next action:
```

## Recommended next task

Continue V3 Visual Shell Port safely.

Steps:

1. Review Jen `MCO-039` read-only audit packet when runtime is available.
2. First shell slice is already implemented: navigation/sidebar, control-room header, truth legend, dashboard grid, panel rhythm, color/type tokens.
3. Keep data contracts unchanged and keep the app read-only.
4. Run `npm run type-check`, `npm run build`, and `npm run supabase:verify` before any commit.
5. Next visual work: polish panels one by one, starting with Projects and Automation Pulse, then Token Usage, Workspace/Git Signals, Source Health, Team, Sync History.
6. Return to Windows Task Scheduler or equivalent startup wrapper for `wsl npm run sync:poll`.
7. Authenticated browser verification of production panels/new shell remains pending; static Vercel deployment must be rechecked after push.
