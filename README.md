# ToolTrack V4.3 — Full Shop Test

This release combines the bulk asset-media workflow with the complete prototype shop so the web service can receive a full test pass before native app work begins.

## Included

- CSV bulk asset import
- Automatic photo/invoice matching from serial numbers in filenames
- Multiple product images and image galleries
- Shop Admin product-image uploads
- Main image selection, image reordering and deletion
- Detailed product pages
- Feature lists and technical specifications
- Sale prices, stock, visibility and featured products
- Basket and prototype orders
- Order statuses: Pending, Processing, Dispatched, Delivered, Completed and Cancelled
- Removal of Locations from the main navigation
- Vercel Web Analytics retained through the installed `@vercel/analytics` package
- Analytics URLs are stripped of query strings and hashes so invitation and transfer tokens are not recorded

## Upgrade an existing beta

1. Copy this project's files over the existing local `tooltrack-beta` project.
2. Keep the existing `.git` folder and any local `.env.local` file.
3. Run the Supabase migration once:

```text
supabase/migrations/20260701_v4_3.sql
```

4. Run locally:

```bash
npm install
npm run typecheck
npm run build
```

5. Commit and push to `main`. Vercel should deploy automatically.

## Shop image testing

Open **Account → Business & team → Shop administration**, edit a product, then upload JPG, PNG, WebP, GIF or AVIF images up to 8 MB each.

The first uploaded image becomes the main image. Images can be reordered, replaced, marked as the main image or deleted.

## Important

- Run the V4.3 migration, not the complete `schema.sql`, against an existing beta database.
- Shop orders remain prototype-only. No payment is taken.
- Keep `NEXT_PUBLIC_APP_URL` set to the active Vercel project domain so new team invitation links use the correct site.
