# ToolTrack V4.7.4

Build fix for V4.7.3.

- Updated the public lookup result TypeScript type to include the owner-aware lookup fields added in V4.7.3.
- Fixes the Vercel build error where `ownedByCurrentUser` was returned by `/app/api/lookup/route.ts` but was missing from `PublicLookupResult`.
- No Supabase schema changes.
