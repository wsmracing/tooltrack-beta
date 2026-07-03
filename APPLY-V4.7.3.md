# Apply ToolTrack V4.7.3

1. Copy this update over the current ToolTrack project and replace matching files.
2. In Vercel, add or update these Production and Preview variables:

```text
RESEND_SIGHTING_FROM_EMAIL=sighting@mail.tooltrack.ie
RESEND_SHOP_FROM_EMAIL=shop@mail.tooltrack.ie
RESEND_SUPPORT_FROM_EMAIL=support@mail.tooltrack.ie
RESEND_REPLY_TO=support@tooltrack.ie
SHOP_ADMIN_EMAILS=support@tooltrack.ie
```

Use plain email addresses exactly as above. Do not add quotes or angle brackets.

3. Remove obsolete variables if still present:

```text
RESEND_TEST_RECIPIENT
RESEND_FROM_EMAIL
```

4. Redeploy Production so Vercel loads the new values.
5. Test these cases:
   - search an asset owned by the signed-in user;
   - confirm the owner message and View asset action;
   - confirm no sighting button is shown to the owner;
   - attempt a direct sighting API request as the owner and confirm it is blocked;
   - report a sighting from another account and confirm the current owner receives it;
   - place a shop order and confirm shop sender/admin notifications;
   - send a support email test.

No Supabase schema migration is required for V4.7.3.

Recommended checks:

```bash
npm run typecheck
npm run build
```
