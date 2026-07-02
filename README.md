# ToolTrack V4.5 closed beta

ToolTrack is a mobile-first asset register, stolen-item checker and ownership-transfer service for tools and other valuable equipment.

## V4.5 highlights

- Cleaner signed-in and signed-out navigation with a visible Log out action
- Simplified Home, Dashboard, My Assets, Account and Shop experiences
- Professional serial-check wording with no “free public lookup” banner
- Public states for registered, offered for sale, transfer pending, stolen, recovered and disputed records
- Temporary six-digit seller-control confirmation for buyers
- Strong 12-character transfer codes stored as hashes, with one-time transactional claims
- Marketplace sighting fields for Adverts.ie, DoneDeal, Facebook Marketplace and other common sources
- Three-step asset registration and clearer evidence language
- Insurance Asset Schedule PDF and Theft Evidence Report PDF, including available asset photographs
- Private evidence indicators and record-strength badges
- Lookup throttling, stricter validation, security headers and `/.well-known/security.txt`
- Vercel Web Analytics retained

## Upgrade from V4.4

1. Back up the current project and Supabase database.
2. Replace the project files with the V4.5 package. Preserve your existing `.env.local` and `.git` folder.
3. Run `supabase/migrations/20260702_v4_5.sql` once in Supabase SQL Editor.
4. Run:

```bash
npm install
npm run typecheck
npm run build
```

5. Commit and push to GitHub. The connected Vercel project should redeploy automatically.

Keep `NEXT_PUBLIC_APP_URL` set to the active site until the custom domain is connected. `NEXT_PUBLIC_SUPPORT_EMAIL` is optional and defaults to `support@tooltrack.ie`.

## Security status

V4.5 adds practical hardening, but it is not a security certification. Before opening the service to real sensitive records or live payments, complete the two-user database and Storage isolation tests in `SECURITY-V4.5.md` and close the High findings from the supplied security assessment.
