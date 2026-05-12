# Sync Bridge Runbook — Mission Control Online

Last updated: 2026-05-12

Runs locally on Raz's workspace machine to push sanitised snapshots of canonical projects, team roster, and source health into the cloud Supabase database so the online dashboard can read them.

## How it works

The bridge:
- reads the local `projects.json` registry
- reads the local `AGENTS_ROSTER.md` canonical roster
- checks source file health
- upserts sanitised rows into Supabase
- records each sync as a `sync_runs` DB row
- polls for manual Refresh requests from the online dashboard every 30 seconds
- performs scheduled syncs every 10 minutes
- never syncs raw memory files, transcripts, secrets, or local absolute paths by default

## Prerequisites

- Node.js 20+
- Local `.env.sync` file with `SUPABASE_SERVICE_ROLE_KEY` set (already done)
- Local Warung Kerja workspace available at the configured path

## Commands

### Start the long-running bridge

```bash
npm run sync:poll
```

This runs the bridge in the foreground. It will:
- sync immediately on start
- poll for manual refresh requests every 30 seconds
- run a scheduled sync every 10 minutes

### Run one manual sync

```bash
npm run sync:once
```

Syncs once and exits. Useful for manual push or testing after a local source change.

### Dry-run without writing

```bash
npm run sync:dry
```

Reads local sources and prints what would be uploaded without touching Supabase.

### Verify Supabase connectivity and RLS

```bash
npm run supabase:verify
```

Checks that the service-role key can count synced rows and that anonymous clients cannot read or write.

## How to check if the bridge is running

```bash
# List running bridge processes
pgrep -af "tsx scripts/sync-bridge.ts" || echo "Bridge is not running"
```

## How to restart the bridge

```bash
# Kill the existing bridge process, then start again
pkill -f "tsx scripts/sync-bridge.ts" || true
npm run sync:poll
```

## How to check the last sync time

Look at the online dashboard or run:

```bash
npm run supabase:verify
```

The `sync_runs` count and last `finished_at` are also visible in the Supabase dashboard.

## What happens if the bridge stops

- The online dashboard still loads the last known snapshot.
- The dashboard shows a stale-data warning.
- Manual refresh requests will queue as pending and not be fulfilled until the bridge restarts.
- No data loss: the bridge is a mirror, not the source of truth.

## Important

Only run **one** bridge process at a time. Running multiple bridges could cause duplicate syncs. The bridge script now includes a single-instance lock to guard against this.

For always-on durability (survive reboots), add a Windows Task Scheduler or WSL startup wrapper later. This is planned for V1.1.
