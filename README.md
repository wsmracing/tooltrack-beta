# ToolTrack V4.2

Clean full-project replacement for the ToolTrack beta.

## Included fixes

- Known-good Next.js root layout with no undeclared Vercel Analytics import.
- Full V4.1 clean interface and stability feature set.
- Team invitation acceptance routes.
- Asset editing repairs and improved form spacing.
- Dashboard and account cleanup.
- Orders inside Account/Dashboard.
- Shop administration route and platform-admin checks.
- Custom ToolTrack 404 page.
- Corrected Supabase shop compatibility migration for legacy `active`, `is_active`, and mandatory `sku` columns.

## Replace the local project

1. Back up `.env.local` if you use one locally.
2. Remove the old project files from your local `tooltrack-beta` folder, but keep the `.git` folder.
3. Copy everything from this V4.2 folder into `tooltrack-beta`.
4. Do not commit `.env` or `.env.local`.
5. In a terminal opened at the project root, run:

```bash
npm install
npm run typecheck
npm run build
```

6. Commit and push the complete replacement to GitHub.

## Supabase

Existing V4 beta database:

- Run `supabase/migrations/20260701_v4_2.sql` once.
- The migration is designed to be rerunnable after a previous partial V4.1 migration.

Fresh database:

- Run `supabase/schema.sql`, followed by migrations in date order.

## Required Vercel variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://tooltrack-beta-ikam.vercel.app
BETA_ACCESS_CODE=
RESEND_API_KEY=
RESEND_FROM_EMAIL=ToolTrack <onboarding@resend.dev>
RESEND_TEST_RECIPIENT=
```

## Deployment

Push to the connected production branch. Vercel should deploy automatically. If needed, redeploy without the previous build cache.
