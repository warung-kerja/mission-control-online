# Project Tracker - Mission Control Online

_Last updated: 2026-05-15 18:15 AEST_
_Current phase: V1.1 operational visibility_
_Current status: V1 complete; V3 shell/panel/nav polish shipped; bridge durability packet reviewed, awaiting Raz approval_

## Current Priority

Keep Mission Control Online stable and read-only, finish bridge durability with Raz approval, and complete authenticated production visual verification.

## Current State Summary

| Area | Status | Notes |
|---|---|---|
| Project folder | Done | Created under `03_Active_Projects/Mission Control/mission-control-online` |
| Master list | Done | Moved to `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` |
| Product docs | Done | Brief, PRD, Epics, Journey, Tracker, Handoff, Worklog |
| Supabase migration | Run successfully | Raz ran `supabase/migrations/001_initial_private_mirror.sql` in Supabase |
| Frontend scaffold | Done | React/Vite dashboard exists and builds |
| Supabase env | Local only | `.env.local` and `.env.sync` are gitignored |
| Sync bridge | V1.1 expanded | Bridge syncs Projects, Team, Source Health, Cron snapshots, Token Usage, and Workspace/Git signals |
| Cron Health | Done | Bridge syncs 61 real cron jobs from local OpenClaw cron state files |
| Token Usage | Done | Bridge syncs daily OpenClaw aggregate token rows; online panel reads `agent_token_usage_daily` |
| Workspace/Git Signals | Shipped | Commit `d114515` pushed; Vercel serves the matching built assets; online panel reads latest `workspace_signal_snapshots` row |
| V3 Visual Match | Shell + panel + nav polish shipped | Shell, panel polish, and nav/scroll-active metadata slices are pushed through `4f0a1d3` |
| Validation | Passing | 2026-05-15 18:15 AEST read-only bridge durability review passed; `npm run supabase:verify` passed |
| Git repo | Published and push verified | Remote switched to SSH; `main` tracks `origin/main` |
| Vercel deploy | Online access verified | Raz confirmed page works from a different computer; magic-link login works |

## Known Blockers / Caveats

### CRON-001 - Live Cron Fetch Needs Stable Gateway CLI Access

Status: Mitigated - local cron file fallback shipped 2026-05-13 09:07 AEST

Current behavior:

- `scripts/sync-bridge.ts` calls the OpenClaw CLI read-only command `cron list --all --json`.
- `OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789` and `OPENCLAW_GATEWAY_TOKEN` are present locally.
- Gateway CLI cron fetch remains flaky because the gateway has event-loop delays and sometimes closes before returning jobs.
- Bridge now reads local OpenClaw cron state files first, which reliably returns 61 real cron jobs.

Next fix:

- Verify the online panel shows real jobs.
- Optionally investigate the gateway event-loop starvation separately.

### BRIDGE-001 - Bridge Not Reboot-Proof

Status: Planning accepted - waiting on Raz approval before persistent scheduler/startup changes

The bridge works as a single process, but it is not yet managed by Windows Task Scheduler or an equivalent startup wrapper. Jen `MCO-044` produced a reviewed no-edit implementation packet covering candidate Task Scheduler command, PID-lock behavior, health checks, rollback, and approval points.

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
| MCO-033 | 2026-05-13 | Codex | Cleaned Cron Health missing-token diagnostic | Done | `sync:once` refreshed live row; Supabase verify passed with 83 sync runs |
| MCO-034 | 2026-05-13 | Codex | Checked Gateway Access URL/token for Cron Health | Partial | Token and URL present; one dry-run saw 61 jobs; later sync attempts hit gateway closed diagnostic |
| MCO-035 | 2026-05-13 | Codex | Added local cron state fallback and synced real cron jobs | Done | `sync:once` wrote 61 cron jobs; Supabase verify sees 62 rows including old adapter row |
| MCO-036 | 2026-05-13 | Codex | Added Workspace/Git signal snapshots and online panel | Done | `sync:once` wrote 1 workspace signal row; Supabase verify sees 1 `workspace_signal_snapshots` row |
| MCO-037 | 2026-05-13 | Noona | Validated, committed, and pushed Workspace/Git Signals | Done | Commit `d114515` pushed to `origin/main`; post-push sync completed |
| MCO-038 | 2026-05-14 | Jen | V3 visual shell port audit | Blocked | Stale/incomplete; superseded by clean retry `MCO-039` |
| MCO-039 | 2026-05-14 | Jen | V3 visual shell port audit clean retry | Done - No Changes | Accepted as planning input for visual polish; no source changes |
| MCO-040 | 2026-05-14 | Noona | V3 visual shell first slice | Done | Commit `0694ee4` pushed; Vercel serves matching assets `index-D7VUWHhX.js` / `index-DtiB_eW1.css`; `type-check`, `build`, `supabase:verify` passed |
| MCO-041 | 2026-05-14 | Jen + Noona | V3 panel polish slice | Done | Commit `91a0906`; validation passed |
| MCO-042 | 2026-05-15 | Jen + Noona | V3 nav polish + scroll-active metadata | Done | Commit `4f0a1d3`; validation passed |
| MCO-043 | 2026-05-15 | Jen | Bridge durability packet first attempt | Blocked | Stale/incomplete; superseded by `MCO-044` |
| MCO-044 | 2026-05-15 | Jen + Noona | Bridge durability implementation packet | Done - No Changes | Packet reviewed; no scheduler changes without Raz approval; `npm run supabase:verify` passed |

## Next Recommended Tasks

### V1.1 Task A - Commit, Push, And Verify Production

Owner: Noona

Status: Mostly done - commit/push complete and Vercel static asset verified; authenticated visual panel verification still needs browser login

Steps:

1. Review current diff. ✅
2. Commit MCO-036 Workspace/Git Signals changes. ✅ `d114515`
3. Push `main` to GitHub. ✅
4. Wait for Vercel deployment. ✅ static asset hash matches local build
5. Verify Automation Pulse and Workspace/Git Signals on production. Partial - Supabase rows and static Vercel assets verified; authenticated visual check still pending

Acceptance criteria:

- Vercel production includes the Workspace/Git panel.
- Supabase rows still read correctly from the live dashboard.
- No secrets or local raw file contents are visible.

### V1.1 Task B - V3 Visual Shell Port

Owner: Jen audit, then Noona implementation

Status: Shell slice, panel polish, and nav polish shipped through MCO-042

Steps:

1. Read local V3 UI code/screens for reference only. ✅
2. Identify shell patterns: nav, dashboard grid, panel hierarchy, status header, colors, typography, spacing. ✅
3. Apply the first shell slice to the online app without changing data contracts. ✅
4. Keep the app read-only. ✅
5. Validate desktop/mobile layouts with WSL build checks. ✅
6. Continue panel-by-panel polish after Jen follow-up audit. ✅ MCO-041 shipped
7. Add nav grouping, scroll-active state, and dynamic header metadata. ✅ MCO-042 shipped

Acceptance criteria:

- Online first screen feels closer to local V3 control room.
- Existing panels keep working.
- No local V3 files are modified.

### V1.1 Task C - Windows Task Scheduler Durability Wrapper

Owner: Noona + Raz

Steps:

1. Review and approve the Task Scheduler plan. ✅ MCO-044 packet accepted by Noona
2. Create a Windows Task Scheduler entry or equivalent startup wrapper after Raz approval.
3. Ensure it runs the WSL `npm run sync:poll` command from this repo.
4. Confirm only one bridge process runs.
5. Confirm sync resumes after restart/sign-in.

Acceptance criteria:

- Bridge survives normal host/session restart.
- Manual refresh requests are still processed.

### V1.1 Task B - Live Dashboard Verification

Owner: Raz + Codex/Noona

Steps:

1. Open the Vercel dashboard after deployment.
2. Confirm Automation Pulse shows real cron jobs.
3. Confirm Git signal shows branch/head/working-tree/recent commits.
4. Confirm no sensitive local values are visible.

Acceptance criteria:

- Cron and Workspace/Git panels are visible on production.
- Panels clearly indicate snapshot freshness.

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
