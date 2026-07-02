# ToolTrack V4.5 security verification

V4.5 implements safer defaults and server routes, but the following checks must be run against the deployed Supabase project. Record the date, tester, request, expected result and actual result.

## Read-only policy inventory

Run in Supabase SQL Editor:

```sql
select n.nspname as schema,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname in ('public', 'storage')
order by 1, 2;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

## Two-user isolation matrix

With User A and User B, create synthetic assets and evidence under each account. Repeat browser requests with the other user’s IDs.

- Assets: SELECT returns no foreign row; UPDATE and DELETE fail.
- Owner/team identifiers: client cannot assign arbitrary `owner_id`, `organization_id` or roles.
- Photos/documents: foreign rows cannot be listed, inserted, overwritten or deleted.
- Storage: direct list/download/update/delete calls against the other asset fail.
- Signed links: copied links expire after the configured period.
- Theft reports and sightings: only authorised asset members can read or change private rows.
- Transfers: only the owner creates/cancels; one intended claimant succeeds once.
- Orders: users see only their own orders and cannot alter total, payment state or another customer’s status.
- Admin: a normal user receives denial when directly calling every admin path.

## Secret and bundle checks

- Search Git history, Vercel logs and `.next/static` for service-role keys, Stripe secrets, Resend keys and webhook secrets.
- Only Supabase URL and anon/publishable key may use `NEXT_PUBLIC_`.
- Rotate any privileged value that has appeared in a commit, screenshot or browser bundle.

## Upload controls

V4.5 performs client validation, which improves UX but is not a complete trust boundary. Before public launch add server-side magic-byte checking, image re-encoding/EXIF removal and document malware scanning or quarantine. Block SVG, HTML and executable formats.

## Rate limiting

The included lookup, transfer and confirmation limiters are best-effort process-memory controls. Configure durable Vercel WAF or another shared limiter before public promotion, then verify 429 responses against the API routes rather than only the pages.

## Browser hardening

V4.5 sends CSP in Report-Only mode. Review reports and required origins before enforcing it. Verify headers on HTML, API, error and auth callback responses. Add HSTS only after the permanent custom domain and every subdomain are HTTPS-ready.

## Launch decision

Closed beta may continue with synthetic or carefully limited data. Real sensitive evidence, unrestricted public registration, live payments and institutional pilots should wait until the High findings have recorded passing evidence.
