# ToolTrack V4.4 beta

ToolTrack is a mobile-first asset registration, stolen-item lookup and tools/accessories shop prototype.

## V4.4 highlights

- Four-item mobile bottom navigation: Home, Lookup, Assets and Add
- Account accessed from the person icon; secondary items live in the hamburger menu
- Mobile drawer closes on selection, outside tap, scroll/swipe and browser navigation
- Simplified dashboard and homepage
- Manual asset-transfer claim with preview and codes accepted with or without dashes
- Team and transfer emails use the active domain instead of a stale Vercel URL
- Shop checkout collects required contact and delivery information
- Friendly customer messages replace raw database errors
- Product and order administration separated into tabs
- Tools & accessories wording throughout the shop
- Help, how-it-works, contact, terms, disputes and delivery/returns pages
- Vercel Web Analytics retained with token/query stripping

## Upgrade

1. Replace the project files with this V4.4 package.
2. Run `supabase/migrations/20260701_v4_4.sql` once in the Supabase SQL Editor.
3. Run `npm install`, `npm run typecheck` and `npm run build`.
4. Commit and push to GitHub. Vercel should redeploy automatically.

Keep `NEXT_PUBLIC_APP_URL` set to the preferred public domain. During Vercel beta testing, server-generated links also protect against a stale generated Vercel hostname.
