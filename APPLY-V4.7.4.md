# Apply ToolTrack V4.7.4

This is a small build-fix patch for V4.7.3.

## Copy files

Copy these files over the current ToolTrack project and replace matching files:

```text
lib/types.ts
VERSION.md
APPLY-V4.7.4.md
```

## Supabase

No Supabase schema changes are required.

## Vercel

No new environment variables are required beyond the V4.7.3 email variables.

## Test

Run:

```bash
npm run typecheck
npm run build
```

Then redeploy.
