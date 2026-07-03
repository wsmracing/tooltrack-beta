# Apply ToolTrack V4.6.7

1. Extract this package over the current ToolTrack project and replace matching files.
2. Confirm this Vercel environment variable exists for Production and Preview:

```text
BETA_ACCESS_CODE=your-private-beta-code
```

3. Keep the existing production URL setting:

```text
NEXT_PUBLIC_APP_URL=https://tooltrack.ie
```

4. Run:

```bash
npm run typecheck
npm run build
```

5. Push the changes or redeploy in Vercel.
6. Test in a new private/incognito browser window at `https://tooltrack.ie`.
7. Confirm an incorrect code is rejected and the correct code opens the site.
8. Confirm `www.tooltrack.ie` securely redirects to `tooltrack.ie`.

The beta access cookie lasts 14 days. Changing `BETA_ACCESS_CODE` in Vercel invalidates all existing beta cookies after the next deployment.

No Supabase SQL migration is required.
