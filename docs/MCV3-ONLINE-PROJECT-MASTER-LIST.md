# Mission Control Online — Project Master List

_Last updated: 2026-05-12 07:20 AEST_  
_Owner: Raz_  
_Tech lead: Noona_  
_Status: Planning / ready for setup_  
_Mode: Private, read-only V1 online mirror_

---

## 1. Project Summary

Mission Control Online is the private cloud-accessible version of Mission Control V3.

It exists so Raz can open Mission Control from another computer without needing to be physically on the local workstation.

The local Mission Control V3 remains the full local operations console. Mission Control Online is a safe read-only mirror backed by Supabase snapshots.

### Core goal

Make Mission Control available online, privately, without exposing Raz's local machine, local filesystem, OpenClaw gateway, or private files directly to the internet.

### V1 principle

Read-only first.

V1 should answer:

> What is happening in my agent/workspace system?

V1 should not yet answer:

> Remotely execute commands on my computer.

---

## 2. Confirmed Decisions

| Decision | Value |
|---|---|
| Hosting | Vercel |
| Database/auth | Supabase |
| Online access | Private, Raz-only |
| Allowed login email | `razifdjamaludin@gmail.com` |
| V1 mode | Read-only |
| Default sync cadence | Every 10 minutes |
| Manual refresh | Yes, planned |
| Local Mission Control V3 safety | Must not break existing local app |
| Repo strategy | Recommended: separate online repo/project |

---

## 3. Recommended Repo Strategy

### Recommendation

Create a new repo/project:

`mission-control-online`

This avoids breaking the current local Mission Control V3 repo while we build the cloud version.

### Why separate repo is recommended

The current Mission Control V3 repo has local-only assumptions:

- Express server running locally
- Socket.IO long-lived server
- SQLite local database
- hardcoded local WSL paths
- OpenClaw CLI subprocess calls
- local session/token logs

The online version needs a different architecture:

- Vercel-hosted frontend
- Supabase Auth
- Supabase Postgres tables
- snapshot-based data reads
- local sync bridge pushing data upward

Trying to force both into the same app immediately creates unnecessary risk.

### What gets duplicated

The new online repo can reuse:

- overall Mission Control visual language
- selected React components
- dashboard screen concepts
- data types/interfaces where useful
- route structure where useful

But it should not copy the local Express/OpenClaw runtime assumptions directly.

### What remains untouched

The current local repo remains:

`/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2`

It continues to run on:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`

No cloud work should modify or destabilize this unless explicitly planned.

---

## 4. Target Architecture

```text
Other computer / browser
        |
        v
Vercel: Mission Control Online frontend
        |
        v
Supabase Auth + Postgres + Realtime
        ^
        |
Local Sync Bridge on Raz's machine
        |
        v
Local Mission Control / OpenClaw / Warung Kerja files
```

### Vercel role

- Hosts the online web app.
- Provides the public/private URL.
- Uses Supabase Auth for login.
- Reads snapshot data from Supabase.

### Supabase role

- Stores synced dashboard snapshots.
- Handles authentication.
- Enforces Row Level Security.
- Stores manual refresh requests.
- Optionally broadcasts realtime updates.

### Local sync bridge role

- Runs locally on Raz's machine.
- Reads local truth sources.
- Sanitizes data.
- Pushes safe snapshots to Supabase.
- Runs automatically every 10 minutes.
- Responds to manual refresh requests when online.

---

## 5. V1 Scope

V1 is a private read-only mirror.

### V1 included screens/modules

#### 5.1 Login

- Supabase Auth login.
- Only `razifdjamaludin@gmail.com` should be allowed.
- No public signup.
- Logged-out users see only login screen.

#### 5.2 Control Room / Home

Shows:

- Last successful sync time.
- Sync health.
- Key snapshot summary.
- Stale data warning if last sync is old.
- Manual refresh button.

#### 5.3 Projects

Data source:

- Local project registry synced to Supabase.

Shows:

- Project name
- Status
- Priority
- Current phase
- Next step
- Owner/team
- Last updated

#### 5.4 Team

Data source:

- Canonical agent roster synced to Supabase.

Shows:

- Raz
- Baro
- Noona
- sub-agents
- ecosystem agents
- role/model metadata

#### 5.5 Automation / Cron Snapshot

Data source:

- OpenClaw cron state synced by local bridge.

Shows:

- Job name
- Enabled/disabled
- Schedule
- Last run
- Next run
- Status
- Error summary if present

#### 5.6 Token Usage Snapshot

Data source:

- Local OpenClaw/session token logs aggregated by bridge.

Shows:

- Daily usage by agent
- Usage ranking
- Total tokens
- Turns
- Average tokens per turn

#### 5.7 Source Health

Data source:

- Local bridge file/git checks.

Shows:

- Whether source files exist/readable
- Last modified times
- Data age
- Git branch/head/status summary

---

## 6. V1 Explicit Non-Goals

Do not include in V1:

- Remote command execution
- Editing local files from online dashboard
- Running OpenClaw jobs directly from browser
- Showing full raw memory files
- Showing raw session transcripts
- Public/team access
- Multi-user permissions beyond Raz-only
- Direct connection from Vercel to local OpenClaw gateway

---

## 7. Manual Refresh Button Plan

Manual refresh is possible, but it should be implemented safely.

### Important detail

The browser/Vercel cannot directly force Raz's local machine to refresh unless the local bridge is running and listening for requests.

The safe implementation is request-based:

1. Raz clicks **Refresh now** in Mission Control Online.
2. The web app inserts a row into Supabase table `sync_requests`.
3. The local sync bridge checks for pending requests.
4. If the bridge is online, it runs sync immediately.
5. The bridge marks the request as completed or failed.
6. The dashboard updates `last synced` and result state.

### Expected UX

Button states:

- `Refresh now`
- `Refresh requested...`
- `Syncing...`
- `Updated just now`
- `Bridge offline — request queued`
- `Refresh failed — see sync log`

### Polling/realtime options

#### Option A — Polling every 30 seconds

Simpler and reliable.

- Bridge checks Supabase every 30 seconds for manual refresh requests.
- Scheduled sync still runs every 10 minutes.

Pros:

- Easy to build.
- Robust.
- No complex realtime setup.

Cons:

- Manual refresh may take up to 30 seconds to start.

#### Option B — Supabase Realtime subscription

More live-feeling.

- Bridge subscribes to `sync_requests` inserts.
- Sync starts nearly instantly.

Pros:

- Better UX.

Cons:

- Slightly more moving parts.

Recommendation for V1:

Use Option A first. Upgrade to realtime later if needed.

---

## 8. Supabase Data Model — Draft

### 8.1 `profiles`

Stores the allowed user profile.

Fields:

- `id uuid primary key references auth.users(id)`
- `email text not null unique`
- `display_name text`
- `role text default 'owner'`
- `created_at timestamptz default now()`

### 8.2 `sync_runs`

Stores sync execution history.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `started_at timestamptz not null`
- `finished_at timestamptz`
- `status text not null` — `running`, `success`, `failed`
- `trigger text not null` — `scheduled`, `manual`, `dry_run`
- `source_host text`
- `summary jsonb`
- `error text`

### 8.3 `sync_requests`

Stores manual refresh requests.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `requested_by uuid references auth.users(id)`
- `requested_at timestamptz default now()`
- `status text default 'pending'` — `pending`, `running`, `completed`, `failed`, `expired`
- `started_at timestamptz`
- `completed_at timestamptz`
- `handled_by text`
- `error text`

### 8.4 `canonical_projects`

Stores current project snapshot.

Fields:

- `id text primary key`
- `name text not null`
- `owner text`
- `team jsonb`
- `status text`
- `priority text`
- `current_phase text`
- `next_step text`
- `source_updated_at timestamptz`
- `synced_at timestamptz not null`

### 8.5 `canonical_team_members`

Stores current team/agent roster snapshot.

Fields:

- `id text primary key`
- `name text not null`
- `role text`
- `model text`
- `agent_group text`
- `parent_agent text`
- `synced_at timestamptz not null`

### 8.6 `cron_job_snapshots`

Stores current cron status snapshot.

Fields:

- `id text primary key`
- `name text`
- `schedule text`
- `status text`
- `enabled boolean`
- `last_run_at timestamptz`
- `next_run_at timestamptz`
- `duration_ms integer`
- `error text`
- `synced_at timestamptz not null`

### 8.7 `agent_token_usage_daily`

Stores token usage aggregates.

Fields:

- `id text primary key` — e.g. `agent:date`
- `agent text not null`
- `date date not null`
- `input_tokens integer default 0`
- `output_tokens integer default 0`
- `cache_read_tokens integer default 0`
- `cache_write_tokens integer default 0`
- `total_tokens integer default 0`
- `turns integer default 0`
- `synced_at timestamptz not null`

### 8.8 `source_health_snapshots`

Stores source/file health.

Fields:

- `id text primary key`
- `label text not null`
- `source_type text`
- `exists boolean`
- `readable boolean`
- `modified_at timestamptz`
- `age_hours numeric`
- `status text`
- `error text`
- `synced_at timestamptz not null`

### 8.9 `workspace_signal_snapshots`

Stores Git/workspace summaries.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `branch text`
- `head text`
- `working_tree text`
- `commits_24h integer`
- `commits_7d integer`
- `latest_commit_at timestamptz`
- `recent_commits jsonb`
- `file_churn jsonb`
- `synced_at timestamptz not null`

---

## 9. Row Level Security Plan

Every table should have RLS enabled.

### Browser/client permissions

Authenticated Raz can:

- read dashboard tables
- create manual sync requests
- read own sync requests
- read sync status/history

Authenticated Raz cannot:

- modify synced snapshots directly
- delete sync history
- change system data manually

### Sync bridge permissions

The local sync bridge uses a service-role key stored only locally.

It can:

- upsert snapshot rows
- insert sync runs
- update sync request statuses

It must never be exposed to browser/Vercel client code.

---

## 10. Environment Variables

### Vercel frontend env

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_DATA_MODE=supabase
VITE_ALLOWED_EMAIL=razifdjamaludin@gmail.com
```

### Local sync bridge env

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SYNC_INTERVAL_MINUTES=10
SYNC_REQUEST_POLL_SECONDS=30
OPENCLAW_GATEWAY_URL=http://localhost:4000
OPENCLAW_GATEWAY_TOKEN=
WARUNG_KERJA_ROOT=/mnt/d/Warung Kerja 1.0
MISSION_CONTROL_LOCAL_REPO=/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2
```

### Never commit

- Supabase service-role key
- OpenClaw gateway token
- JWT secrets
- `.env` files with real secrets

---

## 11. Build Phases

## Phase 0 — Project separation and safety

Goal: protect local Mission Control V3.

Tasks:

- Create local folder for new online project.
- Create new GitHub repo: `mission-control-online`.
- Add README explaining relation to local Mission Control V3.
- Add `.env.example` files.
- Add initial project master list.
- Do not modify local V3 source except docs/planning.

Acceptance criteria:

- Local Mission Control V3 still runs unchanged.
- New online repo exists separately.
- No secrets committed.

## Phase 1 — Supabase project setup

Goal: create cloud data layer.

Tasks:

- Create Supabase project.
- Configure auth.
- Add Raz-only access.
- Create tables.
- Enable RLS.
- Add read policies.
- Add sync request insert policy.

Acceptance criteria:

- Raz can log in.
- Unauthenticated users cannot read tables.
- Tables are ready for sync.

## Phase 2 — Online frontend shell

Goal: deploy a private dashboard shell.

Tasks:

- Create Vite/React frontend or copy minimal UI shell from V3.
- Add Supabase client.
- Add login screen.
- Add protected routes.
- Add Control Room placeholder.
- Add sync status card.

Acceptance criteria:

- App runs locally.
- Login works.
- Logged-out users cannot see dashboard.
- Build passes.

## Phase 3 — Local sync bridge MVP

Goal: push Projects + Team to Supabase.

Tasks:

- Create sync bridge script.
- Read local `projects.json`.
- Read local `AGENTS_ROSTER.md`.
- Transform to Supabase rows.
- Upsert into Supabase.
- Insert `sync_runs` record.
- Add dry-run mode.

Acceptance criteria:

- Dry-run prints safe payload.
- Real sync updates Supabase.
- Projects and Team visible in database.
- No sensitive data uploaded.

## Phase 4 — Projects + Team online views

Goal: first usable online mirror.

Tasks:

- Build Projects page from Supabase.
- Build Team page from Supabase.
- Add stale-data states.
- Add source/sync timestamps.

Acceptance criteria:

- Raz can view Projects and Team from another computer.
- Data matches local source snapshots.
- Staleness is visible.

## Phase 5 — Vercel deployment

Goal: access from real online URL.

Tasks:

- Connect GitHub repo to Vercel.
- Add environment variables.
- Deploy preview.
- Test login and protected routes.
- Promote production.

Acceptance criteria:

- URL works from another computer.
- Login uses `razifdjamaludin@gmail.com`.
- Dashboard data loads from Supabase.
- No local API required.

## Phase 6 — Scheduled sync every 10 minutes

Goal: keep online data fresh.

Tasks:

- Add local scheduled runner.
- Recommended: OpenClaw cron every 10 minutes.
- Alternative: OS cron / Windows Task Scheduler.
- Write sync health to Supabase.

Acceptance criteria:

- Sync runs every 10 minutes.
- Dashboard shows last sync.
- Failed syncs are visible.

## Phase 7 — Manual refresh button

Goal: allow Raz to request immediate refresh.

Tasks:

- Add `Refresh now` button.
- Insert row into `sync_requests`.
- Bridge polls for pending requests every 30 seconds.
- Bridge runs sync on pending request.
- Dashboard shows request status.

Acceptance criteria:

- Button creates request.
- Bridge picks it up.
- Dashboard updates after sync.
- If bridge offline, request shows queued/offline state.

## Phase 8 — Operational panels

Goal: bring Mission Control's useful runtime panels online.

Tasks:

- Sync cron job snapshots.
- Sync OpenClaw runtime summaries.
- Sync token usage aggregates.
- Sync workspace/git source health.
- Build corresponding UI panels.

Acceptance criteria:

- Cron health visible online.
- Token usage visible online.
- Workspace/source health visible online.
- All panels clearly show sync freshness.

## Phase 9 — Hardening

Goal: make it dependable.

Tasks:

- Add error boundary.
- Add empty states.
- Add stale-data warnings.
- Add sync failure diagnostics.
- Add Supabase backup/export notes.
- Add privacy review checklist.

Acceptance criteria:

- Online dashboard does not imply data is live when stale.
- Failures are readable by non-technical Raz.
- No known secret exposure.

---

## 12. Future Roadmap

### V1.1 — Better manual refresh

- Supabase Realtime trigger instead of polling.
- Faster manual refresh response.
- More detailed sync progress.

### V1.2 — Memory metadata

- Sync memory file metadata only.
- Do not sync full memory content by default.
- Show memory file freshness and categories.

### V1.3 — Mobile-friendly view

- Simplified phone dashboard.
- Big sync/status cards.
- Quick project next-step view.

### V2 — Controlled actions

Only after V1 is stable.

Possible features:

- Trigger selected safe OpenClaw cron jobs.
- Start predefined sync tasks.
- Request local diagnostics.

Security requirement:

- Every action must be allowlisted.
- No arbitrary shell commands from browser.
- All actions logged.

### V3 — Multi-agent/team access

Only if Raz wants it later.

Possible features:

- Baro view
- designer-friendly status page
- client-safe project status pages

Not planned for now.

---

## 13. Immediate Next Actions

1. Raz creates Supabase project.
2. Raz confirms project name.
3. Noona scaffolds `mission-control-online` locally.
4. Noona creates Supabase SQL migration.
5. Raz provides Supabase URL + anon key + service role key via secure local `.env` flow.
6. Noona builds sync bridge dry-run.
7. Noona builds login/dashboard shell.
8. Raz creates/approves GitHub repo + Vercel project connection.

---

## 14. Open Questions

1. Supabase project name:
   - Suggested: `mission-control-online`

2. GitHub repo owner/name:
   - Suggested: `warung-kerja/mission-control-online`

3. Vercel project name:
   - Suggested: `mission-control-online`

4. Domain:
   - Start with Vercel default URL.
   - Custom domain later if needed.

5. Local bridge runner:
   - Recommended: OpenClaw cron every 10 minutes.
   - Alternative: OS cron / Windows Task Scheduler.

---

## 15. Noona Recommendation

Yes, create a brand new project/repo for the online version.

This is the safest path because it protects the current local Mission Control V3 while letting us design the online version properly around Supabase snapshots.

Build order:

1. New repo.
2. Supabase schema/auth.
3. Local sync bridge for Projects + Team.
4. Vercel private frontend.
5. Manual refresh request system.
6. Cron/token/workspace operational panels.

Do not migrate or replace the local Mission Control V3 until the online mirror has proven itself.


---

## 16. Progress Update — 2026-05-12 08:00 AEST

### Status

Mission Control Online has moved from planning-only into validated scaffold foundation.

### Completed since project creation

- Created separate `mission-control-online` project folder under `03_Active_Projects/Mission Control/`.
- Moved this master list into the online project docs folder.
- Added README, project brief, PRD, epics, user journey, project tracker, agent handoff, and worklog.
- Added Vite/React/Supabase app scaffold.
- Added Supabase SQL migration draft with private owner/RLS model.
- Added local sync bridge skeleton for Projects, Team, Source Health, scheduled sync, and manual refresh requests.
- Fixed TS-001 validation blocker.

### Validation evidence

```bash
npm run type-check
npm run build
npm run sync:dry
```

Result: passed.

Dry-run result:

- Projects: 8
- Team members: 9
- Source health records: 2

### New operating rule

Every meaningful work session by Noona, Jen, Codex, or any future agent must update:

1. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` for milestone/status changes
2. `docs/PROJECT_TRACKER.md` for task state
3. `docs/WORKLOG.md` for execution evidence
4. `docs/AGENT_HANDOFF.md` when handoff context changes

### Current blockers

- Supabase migration has not been run in the Supabase project yet.
- Service-role key is not configured locally, so real sync writes are not enabled yet.
- GitHub repo and Vercel project have not been created/connected yet.

### Next recommended step

Run `supabase/migrations/001_initial_private_mirror.sql` in the Supabase SQL editor, then configure local bridge secrets through a non-committed env file.


---

## 17. Progress Update — 2026-05-12 08:06 AEST

### Status

Documentation and validation are now aligned after Jen's read-only consistency review.

### Completed

- Confirmed `npm run type-check`, `npm run build`, and `npm run sync:dry` pass.
- Verified local dev server starts on `http://127.0.0.1:5174/` because port `5173` is occupied by local Mission Control V3.
- Added `.env.sync.example` and ensured `.env.sync` is gitignored.
- Cleaned stale docs that still referenced the closed TS-001 blocker.
- Made agent operating rules explicit across README, tracker, handoff, worklog, and this master list.
- Corrected frontend env naming to `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Jen review findings accepted

- Keep master list updates mandatory for milestone/status changes.
- Keep tracker/worklog updates mandatory for every meaningful task.
- Keep handoff updates mandatory when context changes.
- Supabase Auth should still be configured to discourage/disable public signup even though RLS blocks data access for non-owner profiles.
- Service-role key must remain local-only.

### Current blockers

- Supabase SQL migration has not been run yet.
- Supabase service-role key has not been configured locally for real sync.
- GitHub/Vercel setup has not started yet.

### Next recommended step

Run `supabase/migrations/001_initial_private_mirror.sql` in Supabase, then perform real sync setup with local `.env.sync`.


---

## 18. Progress Update — 2026-05-12 11:06 AEST

### Status

Supabase schema/RLS foundation has been created successfully.

### Completed

- Raz ran the initial Supabase SQL migration successfully in the Supabase project.
- Service-role key is ready for local-only `.env.sync` setup.

### Current blocker

Real sync cannot run until `.env.sync` exists locally with `SUPABASE_SERVICE_ROLE_KEY`.

### Next recommended step

Create `.env.sync` from `.env.sync.example`, add the service-role key locally, then run the first real sync.


---

## 19. Progress Update — 2026-05-12 11:11 AEST

### Status

First real Supabase sync completed successfully.

### Completed

- `.env.sync` configured locally with service-role key.
- Confirmed service-role key is present without exposing it in chat/logs.
- Ran `npm run sync:once`.
- Supabase received initial snapshots:
  - Projects: 8
  - Team members: 9
  - Source health records: 2

### Current blockers

- Need to verify auth/login can read synced rows from the frontend.
- GitHub repo and Vercel project still need setup.
- Scheduled 10-minute sync is not configured yet.

### Next recommended step

Test local frontend login against Supabase, then initialize Git/GitHub and connect Vercel.


---

## 20. Progress Update — 2026-05-12 11:14 AEST

### Status

Supabase data and RLS verification passed.

### Completed

- Added `scripts/verify-supabase.ts`.
- Added `npm run supabase:verify`.
- Added `docs/SUPABASE_SETUP.md`.
- Verified synced row counts through service-role client.
- Verified anonymous client cannot read project rows.
- Verified anonymous client cannot insert manual sync requests.
- Re-ran `npm run type-check` and `npm run build` successfully.

### Validation evidence

```bash
npm run supabase:verify
npm run type-check
npm run build
```

Result: passed.

### Current blockers

- Supabase Auth magic-link settings need to be checked in dashboard.
- Local login flow still needs browser verification.
- GitHub/Vercel setup still pending.

### Next recommended step

Verify local login at `http://127.0.0.1:5174/`, then initialize Git/GitHub and connect Vercel.


---

## 21. Progress Update — 2026-05-12 11:19 AEST

### Status

Supabase local auth URL configuration is complete.

### Completed

- Supabase Site URL set for local testing on `http://127.0.0.1:5174`.
- Supabase Redirect URLs include local `5174` URLs.

### Current blockers

- End-to-end login still needs browser verification.
- GitHub/Vercel setup still pending.

### Next recommended step

Initialize Git safely, confirm env files are ignored, then create first local commit before connecting GitHub/Vercel.


---

## 22. Progress Update — 2026-05-12 11:22 AEST

### Status

Local git repository initialized safely.

### Completed

- Initialized git on branch `main`.
- Confirmed `.env.local` and `.env.sync` are ignored.
- Added `*.tsbuildinfo` to `.gitignore`.
- Re-ran validation successfully:
  - `npm run type-check`
  - `npm run build`
  - `npm run supabase:verify`

### Current blockers

- Initial commit has not been created yet.
- GitHub remote has not been created/connected yet.
- End-to-end login still needs browser verification.

### Next recommended step

Create the first local commit, then create/connect the GitHub repo `mission-control-online`.


---

## 23. Progress Update — 2026-05-12 11:24 AEST

### Status

Initial local commit created.

### Completed

- Created local git commit `82e8dfe` with message `chore: scaffold mission control online`.
- Verified secrets were not included in the commit.

### Current blockers

- GitHub remote has not been created/connected yet.
- Vercel project has not been created/connected yet.
- Local browser login still needs end-to-end verification.

### Next recommended step

Create GitHub repo `mission-control-online`, connect remote, and push the local commit.


---

## 24. Progress Update — 2026-05-12 11:28 AEST

### Status

GitHub remote is connected, but push is blocked by local GitHub authentication.

### Completed

- Set `origin` remote to `https://github.com/warung-kerja/mission-control-online.git`.
- Confirmed secrets remain ignored.
- Attempted push to GitHub.

### Blocker

`git push -u origin main` failed because this terminal has no GitHub credentials available:

```text
fatal: could not read Username for 'https://github.com': No such device or address
```

### Current local commits ready to push

- `82e8dfe` — `chore: scaffold mission control online`
- `ea217b1` — `docs: record initial scaffold checkpoint`

### Next recommended step

Push from an authenticated GitHub terminal/GitHub Desktop, or configure credentials for this environment, then re-run:

```bash
git push -u origin main
```


---

## 25. Progress Update — 2026-05-12 11:31 AEST

### Status

GitHub repo has been published by Raz, but this terminal still cannot authenticate to GitHub for fetch/push verification.

### Completed

- Raz reported publishing the repository.
- Remote remains configured as `https://github.com/warung-kerja/mission-control-online.git`.

### Local verification blocker

`git fetch origin main` still fails in this terminal due missing GitHub credentials.

### Next recommended step

Connect the GitHub repo to Vercel and add the Vercel environment variables documented in `docs/VERCEL_DEPLOY.md`.


---

## 26. Progress Update — 2026-05-12 11:34 AEST

### Status

GitHub push from Noona's terminal is now working via SSH.

### Completed

- Confirmed SSH GitHub auth works.
- Switched remote to `git@github.com:warung-kerja/mission-control-online.git`.
- Pushed latest local docs commit to GitHub.
- Local branch `main` now tracks `origin/main`.

### Current blockers

- Vercel project has not been connected yet.
- End-to-end login still needs browser verification.

### Next recommended step

Connect GitHub repo to Vercel and configure browser-safe environment variables.


---

## 27. Progress Update — 2026-05-12 11:49 AEST

### Status

Vercel production deployment exists and needs final Supabase redirect configuration.

### Production URL

```text
https://mission-control-online.vercel.app/
```

### Issue observed

Magic link redirected to `127.0.0.1`, which only works on the same machine running local dev server. Raz tested from another computer, so browser showed `ERR_CONNECTION_REFUSED`.

### Required fix

Update Supabase Auth URL Configuration:

Site URL:

```text
https://mission-control-online.vercel.app
```

Redirect URLs:

```text
https://mission-control-online.vercel.app
http://127.0.0.1:5174
http://localhost:5174
```

Then request a fresh magic link.


---

## 28. Progress Update — 2026-05-12 11:53 AEST

### Status

V1 access milestone is complete.

### Completed

- Vercel production URL works: `https://mission-control-online.vercel.app/`.
- Supabase magic-link redirect now works with the production URL.
- Raz confirmed the page is viewable from a different computer.

### What this means

The core private online access path is working. This proves the Vercel + Supabase architecture is valid.

### Not full V1 complete yet

Full V1 still requires:

1. Scheduled 10-minute sync configured and verified.
2. Manual refresh button verified end-to-end with local bridge processing `sync_requests`.
3. Final V1 acceptance pass after those two items.

### Next recommended step

Configure the local sync bridge to run every 10 minutes, then test the online **Refresh now** button.


---

## 29. Progress Update — 2026-05-12 11:56 AEST

### Status

Mission Control Online is now functionally V1 online, with durability hardening still pending.

### Completed

- Started local background sync bridge: `npm run sync:poll`.
- Bridge performs scheduled sync every 10 minutes.
- Bridge polls manual refresh requests every 30 seconds.
- Verified manual refresh request processing from pending to completed.
- Online app is accessible from another computer and reads Supabase data.

### Current background process

Process session: `tender-dune`

Command:

```bash
npm run sync:poll
```

### V1 status

Functional V1 criteria are met:

- Private online access: done
- Supabase data snapshots: done
- Initial real sync: done
- 10-minute sync loop: running
- Manual refresh processing: verified

### Remaining V1 hardening

- Make the sync bridge durable across restarts.
- Add clearer bridge/offline status UI if needed.
- Final acceptance review after Jen's sync-readiness pass.
