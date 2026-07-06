# ToolTrack V5.0.0

Pre-launch security and contrast release.

## Security

- Account plan/tier changes are removed from the normal Account page.
- Account plan is displayed as read-only and must be changed by an approved admin/payment flow.
- Bulk asset edit no longer allows direct status changes.
- Stolen/recovered/disputed status must go through the proper single-asset workflow so theft reports and audit records are preserved.
- Beta access-code endpoint now uses a Supabase-backed shared rate-limit table instead of in-memory serverless state.
- Beta access cookie lifetime is configurable and defaults to 72 hours instead of 14 days.
- CSP is now sent as an enforced `Content-Security-Policy` header rather than report-only.
- `unsafe-eval` has been removed from the script policy. Inline style/script allowances still require a later nonce/hash pass before final production hardening.

## Contrast and responsive UI

- Completed a CSS-level contrast sweep across the current page set in light and dark modes.
- Added dark-mode contrast guardrails for cards, asset pages, lookup results, shop/order panels, forms, menus, status badges, empty states and footer.
- Fixed the mobile Add asset wizard layout where the Estimated value field could be hidden behind the action buttons.
- Form action bars now stay in normal flow on mobile instead of covering required fields.
- Improved disabled-button readability and dark-mode field focus states.

## Supabase

- Adds `supabase/migrations/20260706_v5_security.sql`.
