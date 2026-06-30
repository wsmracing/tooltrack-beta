# ToolTrack V3.3 Update

Copy every file and folder in this update package into your existing local `tooltrack-beta` repository and allow Windows to replace existing files.

Then:

1. Open Supabase **SQL Editor**.
2. Run `supabase/migrations/20260630_v3_3.sql` once.
3. Add the Resend environment variables in Vercel.
4. In GitHub Desktop, commit with `ToolTrack V3.3 barcode catalogue and email`.
5. Click **Push origin**.
6. Wait for Vercel to deploy, then hard-refresh the site.

## Prototype email settings

```env
RESEND_API_KEY=re_YOUR_KEY
RESEND_FROM_EMAIL=ToolTrack <onboarding@resend.dev>
RESEND_TEST_RECIPIENT=the-email-linked-to-your-resend-account@example.com
```

This reroutes every prototype email to your Resend account email. After verifying a domain, change `RESEND_FROM_EMAIL` to an address at that domain and remove `RESEND_TEST_RECIPIENT` to deliver alerts to the actual asset owner.

## Quick tests

- Search the catalogue for `Makita DHR242`.
- Scan `public/demo-product-barcode-qr.png` from another screen.
- The demo barcode is `5390000000014`.
- Open **Account → Send test email**.
- Submit a sighting and confirm `notification_status` changes to `sent` in Supabase.
- Download the new PDF asset summary from Account.
