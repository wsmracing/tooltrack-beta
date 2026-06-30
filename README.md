# ToolTrack V3.2 Beta

A deployable, mobile-first Next.js prototype for registering assets, storing private proof of ownership, reporting theft and checking serial numbers.

## V3.2 changes

- Clean, centred red-and-white homepage
- Removed the drill artwork and trade-only wording
- Shared page width and mobile gutters to prevent sideways movement
- Wider centred serial-number search
- Register-an-asset action when a lookup has no match
- Expanded tool, garden, shed, site and equipment categories
- Custom category and custom storage-location fields
- Personalised dashboard greeting
- Sighting inbox in the owner dashboard
- Optional email alert when a sighting is submitted
- Listing URLs automatically receive `https://` when omitted
- Account/profile settings and clear logout buttons
- Data export and beta-account deletion
- Confirmations for stolen and recovered status changes
- Improved form loading, success and error feedback

## Demo serial numbers

- `MIL-8891` — reported stolen
- `MAK-4932` — registered and safe
- `BOS-2205` — transfer pending

## Update an existing V3.1 Supabase project

Open Supabase **SQL Editor**, paste the contents of:

```text
supabase/migrations/20260630_v3_2.sql
```

and run it once.

This adds profile preferences, sighting-notification fields and the policy that lets owners mark sightings reviewed.

For a completely new Supabase project, run the full `supabase/schema.sql` instead.

## Environment variables

Add these in Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_SERVER_ONLY_KEY
NEXT_PUBLIC_APP_URL=https://tooltrack-beta.vercel.app
BETA_ACCESS_CODE=your-test-code
```

The service-role key is server-only. Never commit it to GitHub or expose it in screenshots.

## Sighting email alerts

Sightings are always saved to Supabase. To also email the asset owner, add:

```env
RESEND_API_KEY=re_YOUR_KEY
RESEND_FROM_EMAIL=ToolTrack <alerts@your-verified-domain.ie>
```

Use an email provider sender address/domain that is authorised for your test account. After adding or changing Vercel environment variables, redeploy the project.

Without those two variables, the sighting remains available in the dashboard but no email is sent.

## Deploy update

1. Copy the V3.2 update files into the local `tooltrack-beta` repository and replace existing files.
2. In GitHub Desktop, commit the changes.
3. Click **Push origin**.
4. Vercel should create a deployment automatically.
5. Run the V3.2 Supabase migration before testing profile changes or sighting email status.
6. Hard-refresh the browser or close and reopen the installed PWA.

## Local checks

```bash
npm install
npm run typecheck
npm run build
```

## Prototype limitations

- No live payments
- No production moderation portal
- No ownership-transfer workflow
- Email delivery depends on the configured test email provider
- The built-in sighting rate limit is only a lightweight prototype safeguard
- Use test data only until the GDPR, legal and security review is complete
