# Agent Handoff - Mission Control Online

_Last updated: 2026-05-13 07:43 AEST_

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

Current priority is V1.1 operational visibility:

1. Finish real Cron Health by adding local gateway credentials
2. Workspace/Git signal snapshots
3. Reboot-proof bridge durability
5. No V2 remote actions until Raz explicitly approves

## Current technical state

V1 is complete and live as a private read-only Vercel + Supabase mirror.

Current online panels:

- Projects
- Team
- Source Health
- Sync history / Manual Refresh
- Cron Health shell from `cron_job_snapshots`
- Token Usage from `agent_token_usage_daily`

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

No TypeScript/build blocker is currently open.

Latest validation passed from WSL:

```bash
npm run sync:dry
npm run type-check
npm run build
npm run sync:once
npm run supabase:verify
```

Current caveats:

- `cron_job_snapshots` plumbing and UI exist, but the current synced row is a diagnostic failure row because the OpenClaw cron CLI call needs explicit gateway credentials in `.env.sync`.
- `agent_token_usage_daily` plumbing and UI exist. Current Supabase count is 21 aggregate rows.
- The bridge is process-based and not reboot-proof. Windows Task Scheduler or equivalent is still V1.1 work.
- Run validation from WSL. The current `node_modules` native packages are Linux-flavored; Windows Node can type-check, but Vite/Rollup/esbuild native binaries fail from PowerShell.

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

Finish Cron Health V1.1.

Steps:

1. Add valid `OPENCLAW_GATEWAY_TOKEN` or required gateway credentials to local `.env.sync`.
2. Run `npm run sync:dry` from WSL and confirm real cron jobs appear instead of the `openclaw-cron-adapter` diagnostic row.
3. Run `npm run sync:once` from WSL.
4. Verify the online Cron Health panel shows real jobs.
5. Then decide whether to implement Workspace/Git Signals or Windows Task Scheduler durability next.
