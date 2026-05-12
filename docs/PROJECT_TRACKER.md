# Project Tracker — Mission Control Online

_Last updated: 2026-05-12 12:02 AEST_  
_Current phase: Documentation-first foundation + early scaffold_  
_Current status: V1 functional online / durability hardening pending_

## Current priority

Documentation spine and agent handoff clarity first.

Raz explicitly requested this repo be easy to open in Codex Desktop and continue manually or with different agents.

## Current state summary

| Area | Status | Notes |
|---|---|---|
| Project folder | Done | Created under `03_Active_Projects/Mission Control/mission-control-online` |
| Master list | Done | Moved to `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` |
| README | Done | Added project overview and doc order |
| Product docs | Done | Brief, PRD, Epics, Journey added |
| Supabase migration | Run successfully | Raz ran `supabase/migrations/001_initial_private_mirror.sql` in Supabase |
| Frontend scaffold | Drafted | React/Vite shell exists |
| Supabase env | Local only | `.env.local` contains URL + publishable key; not committed |
| Sync bridge | Polling bridge running | `npm run sync:poll` running in background; scheduled sync and manual request processing verified |
| Validation | Passing | `npm run supabase:verify`, `npm run type-check`, `npm run build`, and `npm run sync:dry` passed |
| Git repo | Published and push verified | Remote switched to SSH; `main` tracks `origin/main` |
| Vercel deploy | Online access verified | Raz confirmed page works from a different computer; magic-link login works |

## Known blocker

### TS-001 — Closed validation blocker

Status: Closed — fixed 2026-05-12 08:00 AEST

Observed command:

```bash
npx tsc --noEmit
```

Current failures:

- Supabase client generic typing in `scripts/sync-bridge.ts`
- `ImportMeta.env` type missing for Vite env vars

Likely fixes:

- Add `src/vite-env.d.ts`
- Loosen script Supabase client helper typing or add generated database types later
- Potentially exclude scripts from frontend type-check and add separate node tsconfig

Resolved by adding Vite env typings and loosening sync bridge Supabase client typing until generated DB types are available.

## Work records

| ID | Date | Agent | Task | Status | Evidence |
|---|---|---|---|---|---|
| MCO-001 | 2026-05-12 | Noona | Created online project folder and moved master list | Done | `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` |
| MCO-002 | 2026-05-12 | Noona | Added early Vite/React scaffold and Supabase env | Drafted | `package.json`, `src/`, `.env.local` |
| MCO-003 | 2026-05-12 | Jen | Supabase schema/RLS checklist review | Done | Folded into migration/tracker |
| MCO-004 | 2026-05-12 | Noona | Added initial Supabase migration | Drafted | `supabase/migrations/001_initial_private_mirror.sql` |
| MCO-005 | 2026-05-12 | Noona | Added sync bridge skeleton | Drafted | `scripts/sync-bridge.ts` |
| MCO-006 | 2026-05-12 | Noona | Ran TypeScript validation | Failed | See TS-001 |
| MCO-007 | 2026-05-12 | Noona | Created docs spine for Codex/manual work | Done | README, Brief, PRD, Epics, Journey, Tracker, Handoff, Worklog |
| MCO-008 | 2026-05-12 | Noona | Fixed TS-001 validation blocker | Done | `npm run type-check`, `npm run build`, `npm run sync:dry` passed |
| MCO-009 | 2026-05-12 | Jen | Docs/tracker consistency review | Done | Found stale README/Handoff/Epics references and Supabase migration risks |
| MCO-010 | 2026-05-12 | Noona | Cleaned docs drift after Jen review | Done | README, Tracker, Handoff, Epics, Master List updated |
| MCO-011 | 2026-05-12 | Raz | Ran Supabase initial SQL migration | Done | Supabase SQL editor reported success |
| MCO-012 | 2026-05-12 | Raz + Noona | Configured `.env.sync` and ran first real sync | Done | `npm run sync:once` wrote 8 projects, 9 team members, 2 source health records |
| MCO-013 | 2026-05-12 | Noona | Added Supabase verification script and setup doc | Done | `npm run supabase:verify`, `npm run type-check`, `npm run build` passed |
| MCO-014 | 2026-05-12 | Raz | Configured Supabase local auth URLs | Done | Site URL and redirect URLs set to local `5174` values |
| MCO-015 | 2026-05-12 | Noona | Initialized local git and verified ignored secrets | Done | `.env.local` and `.env.sync` ignored; validation passed |
| MCO-016 | 2026-05-12 | Noona | Created initial local commit | Done | Commit `82e8dfe` (`chore: scaffold mission control online`) |
| MCO-017 | 2026-05-12 | Noona | Connected GitHub remote and attempted push | Blocked | Origin set; `git push -u origin main` failed: missing GitHub credentials |
| MCO-018 | 2026-05-12 | Raz | Published repo to GitHub | Done | Repo published and remote verified |
| MCO-019 | 2026-05-12 | Noona | Switched Git remote to SSH and pushed latest docs | Done | `git push -u origin main` succeeded via SSH |
| MCO-020 | 2026-05-12 | Raz | Created Vercel production deployment | Done | Live URL: `https://mission-control-online.vercel.app/` |
| MCO-021 | 2026-05-12 | Raz | Verified online access from different computer | Done | Magic-link login works and page is viewable remotely |
| MCO-022 | 2026-05-12 | Noona | Started background sync polling bridge | Done | `npm run sync:poll` running in background session `tender-dune` |
| MCO-023 | 2026-05-12 | Noona | Verified manual refresh request processing | Done | Pending `sync_requests` row was processed to `completed`; latest web/request rows completed |
| MCO-024 | 2026-05-12 | Jen | V1 sync-readiness review | Done | Recommended refresh UX hardening and single-bridge runbook |
| MCO-025 | 2026-05-12 | Noona | Hardened Refresh Now UI | Done | Button disables during active requests; dashboard auto-polls every 5s until request settles |

## Next recommended tasks

### Next task A — Supabase setup verification

Owner: Raz + Noona

Steps:

1. Raz opens Supabase SQL editor.
2. Run `supabase/migrations/001_initial_private_mirror.sql`.
3. Configure Supabase Auth for email/magic link.
4. Confirm profile row appears after login.
5. Confirm RLS blocks unauthenticated access.

Acceptance criteria:

- Tables exist.
- RLS active.
- Allowed email works.

### Next task B — Real sync setup

Owner: Noona + Raz

Steps:

1. Create local `.env.sync` from `.env.sync.example` once available.
2. Add `SUPABASE_SERVICE_ROLE_KEY` locally only.
3. Run `npm run sync:once`.
4. Verify rows appear in Supabase.
5. Update tracker/worklog/master list.

Acceptance criteria:

- [x] Real sync writes Projects, Team, and Source Health to Supabase.
- [x] No secrets are committed.

### Next task C — Git/GitHub setup

Owner: Noona + Raz

Steps:

1. Initialize local git repo.
2. Confirm `.env.local` and future `.env.sync` are ignored.
3. Create/attach GitHub repo.
4. Push initial validated scaffold.

Acceptance criteria:

- GitHub repo exists.
- Secrets are not committed.
- Initial commit includes docs, scaffold, migration, and sync bridge.

## Definition of done for any agent task

Every agent must leave:

1. Changed files
2. Summary of work
3. Validation command/result
4. Known risks or blockers
5. `docs/PROJECT_TRACKER.md` update
6. `docs/WORKLOG.md` update
7. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` update for milestone/status changes
8. `docs/AGENT_HANDOFF.md` update when handoff context changes

## Safety rule

Do not modify local Mission Control V3 from this repo.

Current local V3 is separate:

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2
```
