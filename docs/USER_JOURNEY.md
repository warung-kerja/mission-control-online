# User Journey — Mission Control Online

_Last updated: 2026-05-12_

## Primary journey: checking Mission Control from another computer

### 1. Raz opens the Vercel URL

Expected state:

- If logged out, Raz sees login screen.
- If logged in, Raz sees the dashboard.

User need:

- Quick access without setting up local dev tools.

### 2. Raz signs in

Expected state:

- Raz enters `razifdjamaludin@gmail.com`.
- Supabase sends magic link / auth flow.
- App confirms private access.

Failure states:

- Wrong email: blocked.
- Expired magic link: ask to resend.
- Supabase unavailable: clear error.

### 3. Raz lands on Control Room

Expected state:

- Sees last synced timestamp.
- Sees whether data is fresh or stale.
- Sees latest sync status.
- Sees manual refresh button.

Key UX rule:

- Never imply data is live if it is only a stale snapshot.

### 4. Raz reviews Projects

Expected state:

- Projects are listed from latest Supabase snapshot.
- Each project shows current status and next step.
- Empty state appears if no sync has happened.

Questions answered:

- Which projects exist?
- Which ones need movement?
- What is the next step?

### 5. Raz reviews Team

Expected state:

- Agent roster is grouped clearly.
- Roles/models are visible.
- Sub-agent relationships are readable.

Questions answered:

- Who exists in the system?
- Who reports to whom?
- Which model/role is each agent using?

### 6. Raz clicks Refresh now

Expected state:

- Button creates a manual sync request.
- UI shows request queued/requested.
- If bridge is online, sync updates soon.
- If bridge is offline, UI says request is queued or bridge is offline.

Important concept:

- Refresh button does not directly control the local machine from Vercel.
- It creates a safe request that the local bridge chooses to process.

### 7. Raz sees updated data

Expected state:

- Last synced timestamp updates.
- Sync run history records success or failure.
- Projects/Team reflect latest local files.

## Secondary journey: Raz opens repo in Codex Desktop

### 1. Raz opens local folder

Folder:

```text
D:\Warung Kerja 1.0\03_Active_Projects\Mission Control\mission-control-online
```

### 2. Raz or agent reads docs first

Recommended reading order:

1. `README.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/PRD.md`
4. `docs/EPICS.md`
5. `docs/PROJECT_TRACKER.md`
6. `docs/AGENT_HANDOFF.md`
7. `docs/WORKLOG.md`

### 3. Agent checks tracker

Before editing, agent must check:

- Current status
- Active task
- Known blockers
- Last completed task
- Validation status

### 4. Agent performs bounded work

Work should be small and logged.

Examples:

- Fix TypeScript errors
- Update SQL migration
- Add one panel
- Improve sync bridge dry-run

### 5. Agent records work

Agent must update:

- `docs/PROJECT_TRACKER.md`
- `docs/WORKLOG.md`
- `docs/AGENT_HANDOFF.md` if handoff context changed

## Failure journey: local bridge offline

Expected app behavior:

- Dashboard still loads last known snapshot.
- Stale warning appears.
- Manual refresh can queue request.
- UI explains bridge needs to run locally.

## Failure journey: Supabase schema missing

Expected app behavior:

- Dashboard shows readable error.
- Tracker should indicate SQL migration needs to be run.

## Future journey: operational panels

Once V1 is stable, Raz can also check:

- Cron job health
- Token usage by agent
- Workspace source health
- Git/work cadence

These remain snapshot-based unless a later realtime system is added.
