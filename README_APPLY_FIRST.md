# ToolTrack V5.0.1 security patch pack

Apply this as one local branch/commit. Do **not** drip-feed these files into `main` one-by-one.

## Safe order

1. Create a local branch from stable V5/main.
2. Copy these files into the matching paths.
3. Run the Supabase migration in `supabase/migrations/20260706_v5_0_1_security_hardening.sql`.
4. Run:

```bash
npm install --package-lock-only
npm run typecheck
npm run build
```

5. Commit all code + updated package-lock together.
6. Push the branch and let Vercel build a preview first.
7. Merge/deploy production only when the preview build is green.

## Files included

- `lib/rate-limit.ts` — shared Supabase-backed rate limiter.
- `app/api/seller-confirmations/route.ts` — 8-digit seller code, failed attempts, lockout, one active challenge.
- `app/api/auth/signup-notify/route.ts` — requires authenticated Supabase user and validates posted user/email.
- `app/api/lookup/route.ts` — awaits shared limiter and adds repeated-miss throttling.
- `app/api/assets/register/route.ts` — awaits shared limiter.
- `app/api/transfers/route.ts` — awaits shared limiter.
- `app/api/sightings/route.ts` — awaits shared limiter.
- `app/api/beta-access/route.ts` — removes browser-visible debug leak.
- `next.config.ts` — adds HSTS, no preload flag yet.
- `package.json` — bumps to 5.0.1.
- `supabase/migrations/20260706_v5_0_1_security_hardening.sql` — DB changes.

## One caution

`signup-notify` now needs an `Authorization: Bearer <supabase access token>` header. If the frontend currently calls it immediately after signup, make sure it passes the session access token. If your Supabase setup requires email confirmation and does not return a session at signup time, move signup notifications to a Supabase Auth webhook/function instead.
