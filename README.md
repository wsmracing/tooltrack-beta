# ToolTrack V3 Beta

A deployable, mobile-first Next.js prototype for testing ToolTrack with real Supabase accounts and test data.

## What works

- Consistent red-and-white mobile design system
- Public serial-number lookup
- Demo lookup records even before database setup
- Supabase email/password accounts
- Cloud-backed asset dashboard
- Five-step tool registration
- Phone camera/photo selection
- Private receipt and invoice uploads
- Stolen and recovered status changes
- Public lookup of newly registered assets
- Installable PWA shell
- Placeholder security shop

## Demo serial numbers

- `MIL-8891` — reported stolen
- `MAK-4932` — registered and safe
- `BOS-2205` — transfer pending

## 1. Set up the database

Open the Supabase project, then:

1. Go to **SQL Editor**.
2. Choose **New query**.
3. Paste the full contents of `supabase/schema.sql`.
4. Press **Run**.

This creates the tables, row-level security policies and two private storage buckets.

For the easiest closed beta, you may temporarily turn off email confirmation in:

`Authentication -> Providers -> Email -> Confirm email`

Turn it back on before any public launch.

## 2. Environment variables

Use these values locally in `.env.local` and in Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_SERVER_ONLY_KEY
NEXT_PUBLIC_APP_URL=https://tooltrack-beta.vercel.app
BETA_ACCESS_CODE=your-test-code
```

The service-role/secret key is server-only. Never place it in GitHub or expose it in a screenshot.

## 3. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4. Deploy to Vercel

1. Upload the project contents to the root of the GitHub repository.
2. In Vercel, import that repository.
3. Select the **Next.js** framework preset.
4. Keep Root Directory as `./`.
5. Add the environment variables.
6. Deploy.

The GitHub repository must contain `package.json` at its root. An empty repository cannot be deployed.

## Prototype limitations

- No live payments
- No formal admin moderation portal yet
- No ownership transfer workflow yet
- No sighting-message backend yet
- No production legal documents
- Use test data only until the GDPR and security review is complete
