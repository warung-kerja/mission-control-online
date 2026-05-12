# PRD — Mission Control Online

_Last updated: 2026-05-12_

## 1. Product Name

Mission Control Online

## 2. Product Type

Private operational dashboard / read-only cloud mirror.

## 3. Primary User

Raz — creative director/designer/operator who wants to check Mission Control status from other computers without needing direct local workstation access.

## 4. User Need

Raz needs a low-friction way to answer:

- What is happening in my agent system?
- What projects are active?
- Who/what agents exist?
- Is the local system syncing?
- Is data fresh or stale?

## 5. Product Principle

Truth over control.

The online app should first show accurate, clearly timestamped system state. It should not pretend stale snapshots are live data.

## 6. V1 Feature Requirements

### 6.1 Authentication

Requirement:

- User can sign in with Supabase Auth.
- Access is limited to `razifdjamaludin@gmail.com`.
- Logged-out users cannot view dashboard data.

Acceptance criteria:

- Login page appears for unauthenticated visitors.
- Magic link or email auth works.
- Non-allowed users are blocked by Supabase policies, not only frontend checks.

### 6.2 Dashboard home

Requirement:

- Show high-level sync state and basic snapshot summary.

Must show:

- Last successful sync
- Latest sync run status
- Manual refresh status
- Stale data warning if older than freshness threshold

Acceptance criteria:

- If no sync has happened, app says so clearly.
- If bridge is offline/stale, app does not imply live data.

### 6.3 Projects

Requirement:

- Read synced project registry rows from Supabase.

Must show:

- Project name
- Owner
- Team
- Status
- Priority
- Current phase
- Next step
- Synced time

Acceptance criteria:

- Projects render from `canonical_projects`.
- Empty state appears before first sync.

### 6.4 Team

Requirement:

- Read synced agent roster from Supabase.

Must show:

- Agent/member name
- Role
- Model
- Group
- Parent agent if sub-agent

Acceptance criteria:

- Team renders from `canonical_team_members`.
- Members are grouped in a readable way.

### 6.5 Manual refresh request

Requirement:

- Raz can request immediate sync from the online UI.

Implementation:

- Browser inserts a row into `sync_requests`.
- Local bridge polls for pending requests.
- Bridge runs allowed sync only.
- Bridge updates request status.

Acceptance criteria:

- Button creates a pending request.
- If bridge is online, request becomes completed.
- If bridge is offline, UI indicates request is queued/offline.

### 6.6 Local sync bridge

Requirement:

- Local script reads safe local sources and pushes snapshots to Supabase.

V1 sources:

- Project registry JSON
- Agent roster markdown
- Source health for those files

Later sources:

- OpenClaw cron state
- token usage
- git/workspace signals

Acceptance criteria:

- Dry-run mode prints payload without writing.
- Write mode upserts rows to Supabase.
- No secrets/raw transcripts are synced.

## 7. Data Requirements

V1 Supabase tables:

- `profiles`
- `sync_runs`
- `sync_requests`
- `canonical_projects`
- `canonical_team_members`
- `source_health_snapshots`

Later tables:

- `cron_job_snapshots`
- `agent_token_usage_daily`
- `workspace_signal_snapshots`

## 8. Security Requirements

- RLS enabled on every table.
- Service-role key only stored locally for bridge.
- Publishable key can be in Vercel/client.
- Browser cannot write snapshots directly.
- Browser can only create manual sync requests.
- No raw memories or transcripts in V1.

## 9. Deployment Requirements

- Frontend hosted on Vercel.
- Supabase handles auth/database.
- Local sync bridge runs from Raz's machine.
- Current local Mission Control V3 remains untouched.

## 10. Future Requirements

V1.1:

- Cron snapshot panel
- Token usage panel
- Better sync history

V1.2:

- Supabase realtime for manual refresh
- Mobile dashboard polish

V2:

- Carefully allowlisted remote actions, if Raz approves later.
