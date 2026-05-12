# Supabase Setup — Mission Control Online

_Last updated: 2026-05-12_

## Project

Supabase URL:

```text
https://mqvscznkgqoajirbkcrj.supabase.co
```

Allowed owner email:

```text
razifdjamaludin@gmail.com
```

## Completed

- Initial SQL migration has been run successfully.
- `.env.sync` has been configured locally with the service-role key.
- First real sync has completed successfully.

## Verification commands

From project root:

```bash
npm run supabase:verify
```

Expected result:

- Service-role client can count synced rows.
- Anonymous client sees `0` project rows.
- Anonymous client cannot insert manual sync requests.

## Auth settings to check in Supabase

In Supabase dashboard:

1. Go to **Authentication → Providers**.
2. Confirm **Email** provider is enabled.
3. Enable magic-link/OTP email login if available.
4. If there is a **Disable signup** or **Allow new users** setting, prefer disabling public signup after Raz's account exists.
5. Go to **Authentication → URL Configuration**.
6. For local testing, add:

```text
http://localhost:5174
http://127.0.0.1:5174
```

7. Later for Vercel, add the production Vercel URL and preview URL pattern if needed.

## Important security notes

- `VITE_SUPABASE_PUBLISHABLE_KEY` is safe for browser/Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` is not safe for browser/Vercel.
- Service-role key belongs only in local `.env.sync`.
- Do not paste service-role key into chat.
- Do not commit `.env.sync`.

## Known limitation

The SQL migration uses RLS/profile checks to block non-owner data access. Supabase Auth may still technically allow a non-Raz account to be created unless dashboard settings restrict signups. Those users should not be able to read dashboard data, but signup should still be restricted if Supabase allows it.
