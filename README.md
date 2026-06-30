# ToolTrack V4 Beta

ToolTrack V4 is a mobile-first Next.js and Supabase prototype for registering tools and assets, storing private ownership evidence, reporting theft, checking serial numbers, receiving sighting reports, managing locations, importing assets, sharing business access and transferring ownership.

## V4 highlights

- Four prototype account types: Personal, Trade, Business, and Fleet & Hire
- Database-enforced asset limits for each account type
- Bulk-select and bulk-edit assets from the dashboard
- CSV bulk import with validation and preview
- CSV export and readable PDF asset register
- Shared business workspaces and role-based team invitations
- Roles: owner, admin, editor, and viewer
- Saved vans, sheds, workshops, sites, and custom storage locations
- Individual asset editing and automatic audit history
- Private receipt, invoice, document, and image access
- Ownership-transfer codes and optional transfer emails
- Product and serial barcode scanning
- Searchable starter make/model catalogue
- Public stolen-asset lookup and private sighting reports
- Owner sighting emails through Resend
- Consistent mobile navigation and page positioning

## Prototype account types

| Account | Asset limit | Team seats | Bulk edit/import |
| --- | ---: | ---: | --- |
| Personal | 25 | 1 | No |
| Trade | 250 | 1 | Yes |
| Business | 2,000 | 20 | Yes |
| Fleet & Hire | 10,000 | 100 | Yes |

All account types are free and switchable during prototype testing. Payments and real subscription enforcement are intentionally not connected.

## Update an existing V3.3 installation

1. Extract `tooltrack-v4-update.zip`.
2. Copy everything inside the extracted update folder into the local `tooltrack-beta` repository.
3. Allow Windows to replace existing files.
4. In Supabase, open **SQL Editor**.
5. Run only:

   `supabase/migrations/20260701_v4.sql`

6. In GitHub Desktop, commit and push:

   `ToolTrack V4 account tiers and fleet management`

7. Vercel should deploy automatically. If it does not, redeploy the latest `main` commit without the old build cache.

Do not run the full `schema.sql` over an existing database. The full schema is for a completely new Supabase project.

## New Supabase objects

V4 adds:

- `organizations`
- `organization_members`
- `team_invitations`
- `asset_locations`
- `ownership_transfers`
- `asset_audit_log`
- V4 account and plan fields on `profiles`
- organization, location, and notes fields on `assets`
- shared-access RLS policies
- team invitation and transfer RPC functions
- asset-limit enforcement trigger

## Environment variables

Existing V3.3 variables remain valid:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://tooltrack-beta.vercel.app
BETA_ACCESS_CODE=
RESEND_API_KEY=
RESEND_FROM_EMAIL=ToolTrack <onboarding@resend.dev>
RESEND_TEST_RECIPIENT=your-resend-account-email@example.com
```

`SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only secrets. Never prefix them with `NEXT_PUBLIC_`, commit them to GitHub, or paste them into chat.

## Email testing

V4 uses the existing Resend configuration for:

- sighting notifications
- team invitations
- ownership-transfer invitations
- test emails

When using `onboarding@resend.dev`, keep `RESEND_TEST_RECIPIENT` set to the email address linked to the Resend account. The email is rerouted there for prototype testing.

## CSV import format

Required columns:

```text
make,model,category,serial
```

Optional columns:

```text
storage_location,estimated_value,supplier,purchase_date,purchase_price,invoice_number,colour,notes
```

The app includes a downloadable CSV template on the Bulk Import page.

## Recommended V4 test sequence

1. Sign in and open **Account & plan**.
2. Select Trade, Business, or Fleet & Hire and save.
3. Create saved locations.
4. Register an asset and upload a harmless test image and fake receipt.
5. Edit the asset and inspect the audit trail.
6. Select multiple assets and apply a bulk update.
7. Import a small CSV containing unique test serials.
8. Create a team workspace and send an invitation.
9. Create an ownership transfer and accept it from another test account.
10. Mark an asset stolen and submit a public sighting.
11. Confirm the sighting and invitation email records in Resend.
12. Download the PDF asset register and CSV export.

Use fake information and sample documents only during beta testing.

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Validation used for this package:

```bash
npm run typecheck
npm run build
```

Both checks passed before packaging V4.

## Production notes

V4 is still a testing prototype. Before accepting real customer data or payments, complete a security review, DPIA, legal review, verified sending domain, monitoring, backups, billing integration, administrator moderation, abuse controls, and end-to-end tests for team access and ownership transfer.
