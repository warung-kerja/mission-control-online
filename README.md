# Mission Control Online

Private online mirror for Mission Control V3.

This repo is separate from the local Mission Control V3 app so cloud/Vercel/Supabase work cannot break the existing local dashboard.

## Purpose

Mission Control Online lets Raz access a read-only Mission Control dashboard from other computers.

It does **not** directly expose Raz's local machine, WSL filesystem, OpenClaw gateway, or private workspace to the internet.

## Architecture

```text
Browser / other computer
  -> Vercel frontend
  -> Supabase Auth + Postgres snapshots
  <- Local sync bridge pushes safe data from Raz's machine
```

## Local project location

Windows:

```text
D:\Warung Kerja 1.0\03_Active_Projects\Mission Control\mission-control-online
```

WSL:

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online
```

## Source of truth docs

Start here:

1. `docs/PROJECT_BRIEF.md`
2. `docs/PRD.md`
3. `docs/EPICS.md`
4. `docs/USER_JOURNEY.md`
5. `docs/PROJECT_TRACKER.md`
6. `docs/AGENT_HANDOFF.md`
7. `docs/WORKLOG.md`
8. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md`

## Current status

Scaffold validated; Supabase setup pending.

The app scaffold, Supabase migration draft, and local sync bridge dry-run are in place. Latest validation passed: `npm run type-check`, `npm run build`, and `npm run sync:dry`.

See `docs/PROJECT_TRACKER.md` before continuing implementation.

## Operating rules

Every meaningful work session by Noona, Jen, Codex, or any future agent must update:

1. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` for milestone/status changes
2. `docs/PROJECT_TRACKER.md` for task state
3. `docs/WORKLOG.md` for execution evidence
4. `docs/AGENT_HANDOFF.md` when handoff context changes

## Safety rule

Do not modify the local Mission Control V3 repo from this project unless explicitly requested.

Local V3 repo:

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2
```
