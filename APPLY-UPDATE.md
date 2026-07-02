# Apply ToolTrack V4.5 update

1. Back up the project and preserve `.git` and `.env.local`.
2. Copy this folder over the existing V4.4 project and replace matching files.
3. Delete the files listed in `DELETE-OLD-FILES.txt`.
4. Run `supabase/migrations/20260702_v4_5.sql` in Supabase SQL Editor.
5. Run `npm install`, `npm run typecheck` and `npm run build`.
6. Commit and push to the branch connected to Vercel.
