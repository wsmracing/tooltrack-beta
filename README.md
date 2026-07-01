# ToolTrack V4.3 Bulk Import Test

This focused build adds a three-step bulk workflow:

1. Import assets from CSV.
2. Upload multiple photos and PDF/image ownership documents.
3. Match files automatically using serial numbers in filenames, with manual assignment for unmatched files.

## Test naming

- `TT-MAK-DHR242-0001-tool.jpg`
- `TT-MAK-DHR242-0001-serial.jpg`
- `TT-MAK-DHR242-0001-invoice.pdf`

One invoice can link to multiple imported assets when its filename contains both serial numbers.

## Database

No new Supabase migration is required. The build uses the existing `asset_photos`, `asset_documents`, `asset-photos`, and `ownership-documents` resources.

## Local checks

```bash
npm ci
npm run typecheck
npm run build
```
