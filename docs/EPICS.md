# Epics — Mission Control Online

_Last updated: 2026-05-12_

## Epic 0 — Project foundation and documentation

Goal: make the repo safe for Raz, Noona, Codex Desktop, and other agents to work in.

Tasks:

- [x] Create `mission-control-online` folder under `03_Active_Projects/Mission Control/`
- [x] Move master list into online project docs
- [x] Add README
- [x] Add project brief
- [x] Add PRD
- [x] Add epics document
- [x] Add user journey
- [x] Add project tracker
- [x] Add agent handoff
- [x] Add worklog

Acceptance criteria:

- A new agent can understand the project by reading docs first.
- Local Mission Control V3 safety rule is documented.

## Epic 1 — Supabase private data layer

Goal: create the cloud database/auth foundation.

Tasks:

- [x] Draft initial SQL migration
- [x] Include RLS policies
- [x] Include owner helper function
- [x] Include manual refresh request table
- [ ] Raz runs SQL in Supabase
- [ ] Verify Raz-only auth/profile flow
- [ ] Verify unauthenticated users cannot read data

Acceptance criteria:

- Supabase tables exist.
- RLS is active.
- `razifdjamaludin@gmail.com` can read dashboard tables.
- Browser cannot write snapshot tables.

## Epic 2 — Online frontend shell

Goal: create the Vercel-ready app shell.

Tasks:

- [x] Add Vite React app scaffold manually
- [x] Add Supabase client env handling
- [x] Add login shell
- [x] Add dashboard shell
- [x] Add Projects panel
- [x] Add Team panel
- [x] Add Sync status panel
- [x] Add Manual refresh button UI
- [x] Fix current TypeScript issues
- [x] Build passes
- [x] Local dev server verified

Acceptance criteria:

- `npm run build` succeeds.
- App loads locally.
- Login screen appears.
- Dashboard handles empty Supabase tables gracefully.

## Epic 3 — Local sync bridge MVP

Goal: safely publish local Projects + Team snapshots to Supabase.

Tasks:

- [x] Add sync bridge script skeleton
- [x] Add dry-run mode
- [x] Parse project registry
- [x] Parse team roster
- [x] Read source health
- [x] Add Supabase upsert flow
- [x] Add manual request polling flow
- [x] Fix TypeScript typing issues
- [x] Add `.env.sync.example`
- [x] Run dry-run validation
- [ ] Run real sync after service-role key is configured

Acceptance criteria:

- `npm run sync:dry` prints safe payload.
- `npm run sync:once` writes to Supabase when service role key is present.
- No secrets/raw transcripts are uploaded.

## Epic 4 — Manual refresh workflow

Goal: allow Raz to request immediate sync from online UI.

Tasks:

- [x] Frontend inserts pending `sync_requests`
- [x] Bridge can poll pending requests
- [ ] Verify RLS insert policy works
- [ ] Verify bridge marks request running/completed/failed
- [ ] Add clearer UI for queued/offline state

Acceptance criteria:

- Clicking refresh creates one pending request.
- Bridge processes it safely.
- UI displays request status.

## Epic 5 — Vercel deployment

Goal: make app accessible online.

Tasks:

- [ ] Create GitHub repo
- [ ] Push project
- [ ] Create Vercel project
- [ ] Add Vercel env vars
- [ ] Deploy preview
- [ ] Test from another computer
- [ ] Promote to production

Acceptance criteria:

- App is accessible via Vercel URL.
- Login works.
- Dashboard reads Supabase data.

## Epic 6 — Scheduled sync

Goal: keep online snapshot fresh automatically.

Tasks:

- [ ] Decide runner: OpenClaw cron recommended
- [ ] Add 10-minute sync job
- [ ] Add failure logging
- [ ] Add stale-data UI threshold

Acceptance criteria:

- Sync runs every 10 minutes.
- Last sync time updates online.
- Failures are visible.

## Epic 7 — Operational panels

Goal: add more Mission Control runtime data.

Tasks:

- [ ] Cron snapshots
- [ ] Token usage daily snapshots
- [ ] Workspace/git signal snapshots
- [ ] Source health details

Acceptance criteria:

- Runtime panels are useful but clearly snapshot-based.
- No local secrets are exposed.

## Epic 8 — Hardening and polish

Goal: make V1 dependable.

Tasks:

- [ ] Error boundaries
- [ ] Responsive/mobile polish
- [ ] Empty states
- [ ] Loading states
- [ ] Privacy review
- [ ] Backup/export notes

Acceptance criteria:

- Raz can use this without technical interpretation.
- Stale/offline states are obvious.
