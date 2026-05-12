# Project Tracker - Mission Control Online

_Last updated: 2026-05-13 07:43 AEST_  
_Current phase: V1.1 operational visibility_  
_Current status: V1 complete; Cron Health partial; Token Usage shipped_

## Current Priority

Add operational panels while keeping the repo easy for Codex Desktop and future agents to continue.

## Current State Summary

| Area | Status | Notes |
|---|---|---|
| Project folder | Done | Created under `03_Active_Projects/Mission Control/mission-control-online` |
| Master list | Done | Moved to `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` |
| Product docs | Done | Brief, PRD, Epics, Journey, Tracker, Handoff, Worklog |
| Supabase migration | Run successfully | Raz ran `supabase/migrations/001_initial_private_mirror.sql` in Supabase |
| Frontend scaffold | Done | React/Vite dashboard exists and builds |
| Supabase env | Local only | `.env.local` and `.env.sync` are gitignored |
| Sync bridge | V1.1 expanded | Bridge syncs Projects, Team, Source Health, and Cron diagnostic/job snapshots |
| Cron Health | Partial | Online panel and `cron_job_snapshots` sync exist; live OpenClaw cron fetch needs gateway credentials |
| Token Usage | Done | Bridge syncs daily OpenClaw aggregate token rows; online panel reads `agent_token_usage_daily` |
| Validation | Passing | WSL `npm run type-check`, `npm run build`, `npm run sync:once`, and `npm run supabase:verify` passed |
| Git repo | Published and push verified | Remote switched to SSH; `main` tracks `origin/main` |
| Vercel deploy | Online access verified | Raz confirmed page works from a different computer; magic-link login works |

## Known Blockers / Caveats

### CRON-001 - Live Cron Fetch Needs Gateway Credentials

Status: Open - discovered 2026-05-13 07:30 AEST

Current behavior:

- `scripts/sync-bridge.ts` calls the OpenClaw CLI read-only command `cron list --all --json`.
- The current environment writes a diagnostic `openclaw-cron-adapter` row into `cron_job_snapshots`.
- The CLI reports that the gateway URL override requires explicit credentials.

Next fix:

- Add valid local-only OpenClaw gateway credentials to `.env.sync`.
- Run WSL `npm run sync:dry` and confirm real cron jobs appear.
- Run WSL `npm run sync:once` and verify the online panel.

### BRIDGE-001 - Bridge Not Reboot-Proof

Status: Open - V1.1 durability task

The bridge works as a single process, but it is not yet managed by Windows Task Scheduler or an equivalent startup wrapper.

## Closed Blockers

### TS-001 - Closed Validation Blocker

Status: Closed - fixed 2026-05-12 08:00 AEST

Resolved by adding Vite env typings and loosening sync bridge Supabase client typing until generated DB types are available.

## Work Records

| ID | Date | Agent | Task | Status | Evidence |
|---|---|---|---|---|---|
| MCO-001 | 2026-05-12 | Noona | Created online project folder and moved master list | Done | `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` |
| MCO-002 | 2026-05-12 | Noona | Added early Vite/React scaffold and Supabase env | Done | `package.json`, `src/`, `.env.local` |
| MCO-003 | 2026-05-12 | Jen | Supabase schema/RLS checklist review | Done | Folded into migration/tracker |
| MCO-004 | 2026-05-12 | Noona | Added initial Supabase migration | Done | `supabase/migrations/001_initial_private_mirror.sql` |
| MCO-005 | 2026-05-12 | Noona | Added sync bridge skeleton | Done | `scripts/sync-bridge.ts` |
| MCO-006 | 2026-05-12 | Noona | Ran TypeScript validation | Closed | See TS-001 |
| MCO-007 | 2026-05-12 | Noona | Created docs spine for Codex/manual work | Done | README, Brief, PRD, Epics, Journey, Tracker, Handoff, Worklog |
| MCO-008 | 2026-05-12 | Noona | Fixed TS-001 validation blocker | Done | `npm run type-check`, `npm run build`, `npm run sync:dry` passed |
| MCO-009 | 2026-05-12 | Jen | Docs/tracker consistency review | Done | Found stale docs and Supabase migration risks |
| MCO-010 | 2026-05-12 | Noona | Cleaned docs drift after Jen review | Done | README, Tracker, Handoff, Epics, Master List updated |
| MCO-011 | 2026-05-12 | Raz | Ran Supabase initial SQL migration | Done | Supabase SQL editor reported success |
| MCO-012 | 2026-05-12 | Raz + Noona | Configured `.env.sync` and ran first real sync | Done | Wrote 8 projects, 9 team members, 2 source health records |
| MCO-013 | 2026-05-12 | Noona | Added Supabase verification script and setup doc | Done | `npm run supabase:verify`, `npm run type-check`, `npm run build` passed |
| MCO-014 | 2026-05-12 | Raz | Configured Supabase local auth URLs | Done | Site URL and redirect URLs set to local `5174` values |
| MCO-015 | 2026-05-12 | Noona | Initialized local git and verified ignored secrets | Done | `.env.local` and `.env.sync` ignored; validation passed |
| MCO-016 | 2026-05-12 | Noona | Created initial local commit | Done | Commit `82e8dfe` |
| MCO-017 | 2026-05-12 | Noona | Connected GitHub remote and attempted push | Blocked | HTTPS auth unavailable |
| MCO-018 | 2026-05-12 | Raz | Published repo to GitHub | Done | Repo published and remote verified |
| MCO-019 | 2026-05-12 | Noona | Switched Git remote to SSH and pushed latest docs | Done | `git push -u origin main` succeeded via SSH |
| MCO-020 | 2026-05-12 | Raz | Created Vercel production deployment | Done | Live URL: `https://mission-control-online.vercel.app/` |
| MCO-021 | 2026-05-12 | Raz | Verified online access from different computer | Done | Magic-link login works remotely |
| MCO-022 | 2026-05-12 | Noona | Started background sync polling bridge | Done | `npm run sync:poll` session `tender-dune` |
| MCO-023 | 2026-05-12 | Noona | Verified manual refresh request processing | Done | Pending `sync_requests` processed to `completed` |
| MCO-024 | 2026-05-12 | Jen | V1 sync-readiness review | Done | Recommended refresh UX hardening and single-bridge runbook |
| MCO-025 | 2026-05-12 | Noona | Hardened Refresh Now UI | Done | Button disables during active requests; dashboard auto-polls |
| MCO-026 | 2026-05-12 | Noona | Added Source Health panel to online dashboard | Done | Validation passed |
| MCO-027 | 2026-05-12 | Jen | Bridge durability review | Done | Recommended runbook + single-instance guard for V1 |
| MCO-028 | 2026-05-12 | Noona | Applied V1 hardening from Jen review | Done | Added bridge runbook, PID lock, V1 marked complete |
| MCO-029 | 2026-05-12 | Jen | Cron bridge portability audit | Done | Recommended porting `openclawClient.ts` into sync bridge |
| MCO-030 | 2026-05-12 | Noona | Full docs refresh per Raz request | Done | README, PRD, Epics, Handoff, Tracker, Worklog, Master List updated |
| MCO-031 | 2026-05-13 | Codex | Added Cron Health snapshot plumbing and online panel | Partial | WSL validation passed; Supabase has 1 cron diagnostic row; live cron jobs need gateway credentials |
| MCO-032 | 2026-05-13 | Codex | Added Token Usage snapshot sync and online panel | Done | WSL validation passed; Supabase has 21 `agent_token_usage_daily` rows |

## Next Recommended Tasks

### V1.1 Task A - Finish Live Cron Health

Owner: Codex/Noona + Raz

Steps:

1. Add local-only OpenClaw gateway credentials to `.env.sync`.
2. Run WSL `npm run sync:dry`.
3. Confirm real cron job rows appear instead of only the adapter diagnostic row.
4. Run WSL `npm run sync:once`.
5. Verify Cron Health on the Vercel dashboard.

Acceptance criteria:

- Real cron jobs are synced into `cron_job_snapshots`.
- Cron Health panel shows job status, schedule, last/next run, duration, and errors.
- No gateway token is exposed to browser/Vercel.

### V1.1 Task B - Windows Task Scheduler Durability Wrapper

Owner: Noona + Raz

Steps:

1. Create a Windows Task Scheduler entry or equivalent startup wrapper.
2. Ensure it runs the WSL `npm run sync:poll` command from this repo.
3. Confirm only one bridge process runs.
4. Confirm sync resumes after restart/sign-in.

Acceptance criteria:

- Bridge survives normal host/session restart.
- Manual refresh requests are still processed.

### V1.1 Task C - Workspace/Git Signals Panel

Owner: Codex/Noona

Steps:

1. Inspect local V3 workspace signal adapter.
2. Add bridge-side safe repo/source summary sync.
3. Add online dashboard panel.
4. Validate and document.

Acceptance criteria:

- Workspace/git signals sync without raw private file content.
- Panel shows branch, head, working tree, recent commit cadence, and source freshness.

## Definition Of Done For Any Agent Task

Every agent must leave:

1. Changed files
2. Summary of work
3. Validation command/result
4. Known risks or blockers
5. `docs/PROJECT_TRACKER.md` update
6. `docs/WORKLOG.md` update
7. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` update for milestone/status changes
8. `docs/AGENT_HANDOFF.md` update when handoff context changes

## Safety Rule

Do not modify local Mission Control V3 from this repo.

Current local V3 is separate:

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2
```
