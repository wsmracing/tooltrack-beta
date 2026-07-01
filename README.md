# ToolTrack V4.1 Clean Fix Release

V4.1 is a stability and interface clean-up release for the ToolTrack beta.

## Fixes
- Working team invitation routes with sign-in return, accept and decline.
- Asset edit trigger repair and corrected edit form spacing.
- Clean dashboard overview; full asset management moved to `/assets`.
- Account content split into clear tabs.
- My Orders moved into Account and Dashboard.
- Working beta shop, order history and Shop Administration.
- Platform admin role table; the oldest beta account is bootstrapped as super-admin.
- Friendly ToolTrack 404 page.

## Existing project update
1. Run `supabase/migrations/20260701_v4_1.sql` once in Supabase SQL Editor.
2. Copy the update files over the existing repository.
3. Commit and push to GitHub.
4. Confirm `NEXT_PUBLIC_APP_URL` uses the surviving Vercel project URL.

## Important
The V4.1 migration deliberately removes legacy custom triggers from `public.assets` and recreates only ToolTrack's updated-at, audit and plan-limit triggers. This repairs the beta database error involving an integer value being written into a boolean `is_active` column.

Shop checkout remains a no-payment prototype.
