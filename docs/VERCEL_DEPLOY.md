# Vercel Deploy Checklist — Mission Control Online

_Last updated: 2026-05-12_

## Before deploying

Run locally:

```bash
npm run supabase:verify
npm run type-check
npm run build
```

All must pass.

## GitHub setup

1. Initialize git locally.
2. Confirm secrets are ignored:
   - `.env.local`
   - `.env.sync`
3. Create GitHub repo, suggested:

```text
warung-kerja/mission-control-online
```

4. Push initial validated scaffold.

## Vercel project settings

Create a new Vercel project from the GitHub repo.

Recommended settings:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Vercel environment variables

Add only browser-safe values:

```env
VITE_SUPABASE_URL=https://mqvscznkgqoajirbkcrj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_ALLOWED_EMAIL=razifdjamaludin@gmail.com
```

Never add these to Vercel:

```env
SUPABASE_SERVICE_ROLE_KEY
OPENCLAW_GATEWAY_TOKEN
```

## Supabase URL configuration

After Vercel creates the deployment URL:

1. Go to Supabase → Authentication → URL Configuration.
2. Set Site URL to the Vercel production URL.
3. Add Redirect URLs:

```text
http://127.0.0.1:5174
http://localhost:5174
https://mission-control-online.vercel.app
https://mission-control-online-*.vercel.app
```

The local app is pinned to port `5174` so it does not conflict with local Mission Control V3 on `5173`.

## Post-deploy verification

1. Open Vercel URL.
2. Request magic link with `razifdjamaludin@gmail.com`.
3. Confirm dashboard loads.
4. Confirm Projects and Team data appear.
5. Click **Refresh now**.
6. Confirm pending request appears.
7. Run/keep local bridge active and confirm request completes.

## Current deployment blockers

- Local auth/login flow still needs browser verification.
- GitHub repo has not been created/pushed yet.
- Vercel project has not been connected yet.


## Production URL

```text
https://mission-control-online.vercel.app
```
