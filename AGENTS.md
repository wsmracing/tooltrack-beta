# ToolTrack V4 repository guidance

- Mobile-first Next.js application with Supabase.
- Keep private documents private and use signed URLs.
- Never expose the Supabase service key or Resend API key to browser code.
- Maintain RLS for every new user-owned or organization-owned table.
- Run `npm run typecheck` and `npm run build` before deployment.
- Apply database changes through a new migration; do not rewrite an existing live schema.
