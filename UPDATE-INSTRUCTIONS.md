# ToolTrack V4.1 update

1. Copy everything in this folder into the existing `tooltrack-beta` repository.
2. Allow Windows to replace existing files.
3. Run `supabase/migrations/20260701_v4_1.sql` once in Supabase SQL Editor.
4. In Vercel add `SHOP_ADMIN_EMAILS` using the email address used to sign in to ToolTrack.
5. Commit and push to `main`.
6. Wait for the Vercel production deployment to finish.

The shop checkout creates test orders only. No payment is taken in V4.1.
