# ToolTrack V4.1 Beta

ToolTrack V4.1 is the mobile-first Next.js and Supabase beta for asset registration, public stolen-asset lookup, team workspaces and the first database-backed security shop.

## V4.1 changes

- One centred responsive page shell across dashboard, assets, team, account and shop
- Separate **Dashboard** and **My assets** pages
- `/my-tools` now redirects to `/assets`
- Recovered asset count added to the dashboard
- Team invitation page retained through sign-in and signup
- Planned account prices displayed while every tier remains free in beta
- Community make/model catalogue grows from repeated registrations
- Existing assets are counted during the V4.1 migration
- A model is promoted to autocomplete after five matching registrations
- Vercel Web Analytics included in the production layout
- Service worker no longer caches application pages or old Next.js code
- Update prompt shown when a new ToolTrack build is available
- Legal footer for ToolTrack Technologies Limited, trading as ToolTrack
- Database-backed shop products, stock and beta orders
- User order history
- Restricted shop administration for products, stock and order status

## Planned account prices

| Account | Planned price | Asset limit | Team seats |
| --- | ---: | ---: | ---: |
| Personal | Free | 25 | 1 |
| Trade | €4.99/month | 250 | 1 |
| Business | €9.99/month | 2,000 | 20 |
| Fleet & Hire | €24.99/month | 10,000 | 100 |

All plans remain free and switchable during beta. No subscription payment is taken.

## Update an existing V4 installation

1. Extract `tooltrack-v4.1-update.zip`.
2. Copy everything inside the extracted update folder into the local `tooltrack-beta` repository.
3. Allow Windows to replace existing files.
4. In **Supabase → SQL Editor**, run only:

   `supabase/migrations/20260701_v4_1.sql`

5. Add the optional shop administrator environment variable in Vercel:

```env
SHOP_ADMIN_EMAILS=your-login-email@example.com
```

Use the same email address used to sign in to ToolTrack. Multiple administrators can be comma-separated.

6. In GitHub Desktop, commit and push:

   `ToolTrack V4.1 responsive shell and shop backend`

7. Wait for Vercel to deploy the new `main` commit.

Do not run the full `schema.sql` over an existing database.

## Shop backend

V4.1 adds these Supabase tables:

- `shop_products`
- `shop_orders`
- `shop_order_items`
- `shop_admins`

The migration seeds six test products. The public shop reads products and stock from Supabase. Signed-in users can create beta orders and view them under **Account → Shop orders**.

The beta checkout deliberately takes no payment. Order status begins as `beta_pending` and payment status as `not_charged`.

Open the restricted shop backend at:

```text
/shop/admin
```

The shop administrator can:

- Add products
- Set price and stock
- Enable or disable products
- Review beta orders
- Change order status

For prototype access, use `SHOP_ADMIN_EMAILS`. A production version should use database roles, staff audit logs, inventory reservations, tax/shipping rules and a payment provider.

## Community make/model catalogue

The V4.1 database trigger normalises make and model values. Variations in punctuation and spacing are grouped together. For example:

```text
DS-1233
DS1233
ds 1233
```

After five matching asset registrations, the model becomes active in the quick-search catalogue as a community entry. Existing registered assets are counted when the migration is run.

This is a useful signal rather than proof that a manufacturer officially recognises a model. Community entries should eventually be reviewable from an administrator console.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://tooltrack-beta.vercel.app
BETA_ACCESS_CODE=
RESEND_API_KEY=
RESEND_FROM_EMAIL=ToolTrack <onboarding@resend.dev>
RESEND_TEST_RECIPIENT=your-resend-account-email@example.com
SHOP_ADMIN_EMAILS=your-login-email@example.com
```

`SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only secrets. Never put them in GitHub or prefix them with `NEXT_PUBLIC_`.

## Analytics

V4.1 includes:

```tsx
import { Analytics } from "@vercel/analytics/next";
```

and renders `<Analytics />` in `app/layout.tsx`. Enable Web Analytics in Vercel and deploy V4.1. Analytics begins collecting from that deployment onward.

## Suggested V4.1 test sequence

1. Open Dashboard and My Assets at desktop and phone widths.
2. Confirm neither page stretches across the viewport.
3. Open an invitation email while logged out and complete sign-in.
4. Confirm the invitation returns to `/team/accept` rather than a 404.
5. Review account tier prices and beta wording.
6. Register repeated test make/model values and inspect `product_catalogue`.
7. Open the shop and create a beta order.
8. View the order under `/shop/orders`.
9. Add `SHOP_ADMIN_EMAILS`, redeploy and open `/shop/admin`.
10. Add a test product and update an order status.
11. Confirm Vercel Analytics records page visits.
12. Confirm a new deployment replaces the old frontend without clearing browser data manually.

Use fake details and test documents only.

## Validation

```bash
npm run typecheck
npm run build
```

Both checks passed before packaging V4.1.
