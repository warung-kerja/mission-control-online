# Project Brief — Mission Control Online

_Last updated: 2026-05-12_  
_Project owner: Raz_  
_Tech lead: Noona_  
_Status: Documentation-first foundation_

## One-line brief

Build a private online, read-only mirror of Mission Control V3 so Raz can check agent/workspace status from any computer without exposing the local machine directly to the internet.

## Background

Mission Control V3 currently runs locally and reads directly from Raz's local Warung Kerja workspace, OpenClaw runtime, session logs, git state, and canonical files.

Raz wants access from other computers. The safest cloud approach is not to expose the local machine. Instead, the online app should read from Supabase snapshots that are pushed by a local sync bridge.

## Problem

Raz cannot easily access Mission Control V3 away from the local machine. Directly hosting the existing app is risky because it depends on:

- local WSL filesystem paths
- local SQLite database
- OpenClaw CLI/runtime state
- long-running Express + Socket.IO server
- private workspace files

## Goal

Create a separate `mission-control-online` repo that provides:

- private login
- read-only dashboard
- Supabase snapshot data
- Vercel hosting
- local sync bridge
- clear docs/tracker so Raz or any agent can continue work safely

## Non-goals for V1

- No remote command execution
- No editing local files from the web app
- No triggering arbitrary OpenClaw jobs
- No public/team access
- No raw memory/session transcript sync
- No replacement of local Mission Control V3

## Success criteria

V1 is successful when:

1. Raz can open the online app from another computer.
2. Login is restricted to `razifdjamaludin@gmail.com`.
3. Projects and Team snapshots load from Supabase.
4. Sync status clearly shows last update time.
5. Manual refresh can be requested safely.
6. Local Mission Control V3 remains unaffected.
7. Project docs are complete enough for Codex/Desktop/other agents to continue work.

## Recommended execution order

1. Documentation spine
2. Supabase SQL schema + RLS
3. App scaffold validation
4. Supabase auth/login shell
5. Projects + Team read-only views
6. Local sync bridge dry-run
7. Local sync bridge writes to Supabase
8. Manual refresh request flow
9. Vercel deploy
10. Cron/token/workspace panels
