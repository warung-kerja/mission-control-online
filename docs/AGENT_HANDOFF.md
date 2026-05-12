# Agent Handoff — Mission Control Online

_Last updated: 2026-05-12 22:20 AEST_

## Read this first

This repo is the separate online/private mirror of Mission Control V3.

Do **not** treat this as the local Mission Control V3 repo.

## Project path

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-online
```

## Local Mission Control V3 path — do not touch unless explicitly requested

```text
/mnt/d/Warung Kerja 1.0/03_Active_Projects/Mission Control/mission-control-v2
```

## Required reading order

Before working:

1. `README.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/PRD.md`
4. `docs/EPICS.md`
5. `docs/PROJECT_TRACKER.md`
6. `docs/WORKLOG.md`

For big-picture plan:

7. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md`

## Current user intent

Raz wants this repo to be usable manually in Codex Desktop and by multiple agents over time.

Priority is:

1. brief
2. PRD
3. epics
4. user journey
5. detailed project tracker
6. clear work records
7. only then implementation

## Current technical state

A draft app scaffold exists.

Important files:

- `package.json`
- `.env.example`
- `.env.local` — local only, do not commit
- `src/App.tsx`
- `src/lib/supabase.ts`
- `src/types/supabase.ts`
- `src/styles.css`
- `scripts/sync-bridge.ts`
- `supabase/migrations/001_initial_private_mirror.sql`

## Current blocker

No TypeScript/build blocker currently open.

Latest validation passed:

```bash
npm run type-check
npm run build
npm run sync:dry
```

Current setup blockers:

- Supabase SQL migration still needs to be run in the Supabase project.
- Service-role key is not configured locally, so real sync writes are not enabled yet.
- GitHub/Vercel setup has not started yet.

## Supabase details

Project URL:

```text
https://mqvscznkgqoajirbkcrj.supabase.co
```

Publishable key is stored locally in `.env.local`.

Do not ask Raz to paste service-role key into chat. When needed, use local `.env.sync` / secure local setup.

## Security rules

- Never commit `.env.local` or service-role keys.
- Never expose Supabase service-role key to Vercel/browser.
- V1 is read-only.
- Manual refresh should only request a sync, not execute arbitrary commands.
- Do not sync raw memories, transcripts, secrets, or gateway tokens.

## Required work logging

After each meaningful task, update:

1. `docs/MCV3-ONLINE-PROJECT-MASTER-LIST.md` for milestone/status changes
2. `docs/PROJECT_TRACKER.md` for task state
3. `docs/WORKLOG.md` for execution evidence
4. This file if handoff context changes

Minimum record format:

```text
Date/time:
Agent:
Task ID:
Files changed:
Summary:
Validation:
Risks/blockers:
Next action:
```

## Recommended next task

Run Supabase setup verification.

Steps:

1. Run `supabase/migrations/001_initial_private_mirror.sql` in the Supabase SQL editor.
2. Configure Supabase Auth for Raz-only magic link access.
3. Create local `.env.sync` with service-role key when ready.
4. Run real sync via `npm run sync:once`.
5. Update master list, project tracker, and worklog.
