# ToolTrack UI restore from commit e9cc372

This pack restores the visual baseline from commit:

`e9cc372c98643efd4d649294fe4cb3a5137334c4`

## Files included

- `app/layout.tsx`
- `app/e9cc372-visual-restore.css`
- `components/brand.tsx`
- `components/app-shell.tsx`

## What this fixes

- Restores the e9cc372 wordmark-only logo component.
- Removes the accidental `v5.css` import that caused a missing-module build error.
- Keeps the V4.8/gallery imports that existed in e9cc372.
- Adds a small visual restore CSS file to force the expected page/header width and dark-mode contrast baseline.

## Apply

Copy these files into your repo, then run:

```bash
npm run typecheck
npm run build
```

## Notes

This pack intentionally does not include SQL.
It does not touch API/security files.
