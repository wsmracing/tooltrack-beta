# Apply ToolTrack V4.7.1

1. Copy this update over the current ToolTrack project and replace matching files.
2. Run the included Supabase migration in SQL Editor. It is repeatable and replaces `place_shop_order` without the invalid JWT claim check.
3. In Supabase Authentication URL Configuration, ensure these are allowed:

```text
https://tooltrack.ie/**
https://tooltrack.ie/reset-password
http://localhost:3000/**
```

4. In Vercel, use:

```text
RESEND_FROM_EMAIL=ToolTrack <noreply@mail.tooltrack.ie>
RESEND_REPLY_TO=support@tooltrack.ie
```

Remove `RESEND_TEST_RECIPIENT` because V4.7.1 sends to the real intended recipient.

5. Run:

```bash
npm run typecheck
npm run build
```

6. Redeploy and test password reset, checkout, and a sighting against an asset owned by a different account.
