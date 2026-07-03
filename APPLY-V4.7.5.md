# Apply ToolTrack V4.7.5

Copy these files over the current ToolTrack project and replace matching files:

```text
app/api/shop/orders/route.ts
app/asset/[id]/page.tsx
app/shop/shop-client.tsx
app/globals.css
supabase/migrations/20260703_v4_7_5.sql
VERSION.md
APPLY-V4.7.5.md
```

## Supabase

Run this migration in the Supabase SQL Editor:

```text
supabase/migrations/20260703_v4_7_5.sql
```

It is repeatable. It adds/replaces the helper function used by the server checkout route to decrement shop stock safely.

## Vercel

Keep the V4.7.3 email variables:

```text
RESEND_SIGHTING_FROM_EMAIL=sighting@mail.tooltrack.ie
RESEND_SHOP_FROM_EMAIL=shop@mail.tooltrack.ie
RESEND_SUPPORT_FROM_EMAIL=support@mail.tooltrack.ie
RESEND_REPLY_TO=support@tooltrack.ie
SHOP_ADMIN_EMAILS=support@tooltrack.ie
```

## Test

Run:

```bash
npm run typecheck
npm run build
```

Then test:

- shop checkout success
- failed checkout shows useful beta/debug error
- customer shop email
- admin shop email
- stock reduction
- asset detail dark-mode contrast
- asset photo thumbnails
- invoice/receipt evidence cards
