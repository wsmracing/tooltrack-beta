# Apply ToolTrack V5.0.0

Copy these files over the current ToolTrack project and replace matching files.

## Included files

```text
app/account/page.tsx
app/assets/page.tsx
app/api/beta-access/route.ts
app/globals.css
next.config.ts
.env.example
package.json
package-lock.json
supabase/migrations/20260706_v5_security.sql
VERSION.md
APPLY-V5.0.0.md
```

## Supabase

Run this migration in Supabase SQL Editor before testing the beta gate:

```text
supabase/migrations/20260706_v5_security.sql
```

## Vercel environment variables

Optional:

```text
BETA_COOKIE_MAX_AGE_HOURS=72
```

Keep your existing Supabase and Resend variables.

## Critical security checks

- Confirm Account page shows plan as read-only.
- Confirm users cannot change `plan_tier` from the Account page.
- Confirm bulk edit only supports Storage location and Category.
- Confirm stolen status still uses the asset detail stolen-report workflow.
- Confirm beta access locks out repeated failed attempts.
- Confirm CSP is enforced in browser response headers.

## Contrast checks completed in this patch

CSS-level pass completed for the current route set:

```text
Home
Dashboard
Check / lookup
Asset list
Asset detail
Add asset wizard
Account
Orders
Shop
Shop admin panels
Team
Transfer
Import
Locations
Sightings
Help
How it works
Privacy
Terms
Contact
Forgot password
Reset password
Beta access gate
404
```

Breakpoints covered in CSS:

```text
Desktop
Tablet / narrow desktop
Phone
Phone with bottom navigation
```

Please still do live browser testing after deployment because exact screenshots depend on seeded data and uploaded files.

## Test

Run:

```bash
npm run typecheck
npm run build
```

Then deploy.
