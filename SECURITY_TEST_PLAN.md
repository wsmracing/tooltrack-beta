# V5.0.1 security test plan

## Build checks

```bash
npm install --package-lock-only
npm run typecheck
npm run build
```

## Required Supabase checks

Use two real users in two browser profiles.

1. User A creates an asset.
2. User B attempts to query User A rows directly through Supabase client:
   - `assets`
   - `asset_photos`
   - `asset_documents`
   - `asset_locations`
   - `asset_audit_log`
   - `ownership_transfers`
   - `theft_reports`
   - `profiles`
3. Expected: zero rows or permission denied.
4. User B attempts `/api/storage/sign` for User A storage paths.
5. Expected: no signed URLs returned.
6. User A creates a seller confirmation challenge.
7. Confirm the buyer code is 8 digits.
8. User A enters 5 wrong codes.
9. Expected: challenge locks and returns lock error.
10. Try repeated public lookup misses from same IP.
11. Expected: rate limit after repeated misses.

## Storage policy rule to verify in Supabase

Private upload policies should enforce user-prefixed paths. Typical pattern:

```sql
split_part(name, '/', 1) = auth.uid()::text
```

Also verify users cannot insert `asset_photos` or `asset_documents` rows with another user's `owner_id`.
