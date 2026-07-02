# ToolTrack V4.5 testing checklist

Use two separate normal accounts, plus a Business/Fleet account and a platform-admin account where available. Use synthetic records only during the first pass.

## 1. Build and migration

- Run `20260702_v4_5.sql` successfully after the V4.4 migration.
- Run `npm install`, `npm run typecheck` and `npm run build`.
- Confirm Vercel deploys the same commit without install or type errors.
- Confirm `/.well-known/security.txt` loads as plain text.
- Confirm Vercel Analytics still records page views without lookup, invite or transfer tokens.

## 2. Navigation and mobile cleanup

- Signed out: Check, How it works and Sign in are visible on desktop.
- Signed in: Dashboard, Check, Assets and Add asset are visible on desktop.
- Mobile bottom bar contains Home, Check, Assets and Add only.
- Person icon opens Account.
- Hamburger contains only relevant secondary destinations.
- Team is hidden for Personal/Trade accounts and shown for Business/Fleet.
- Log out is visible in the hamburger and Account page.
- Log out returns to the public homepage and updates the header immediately.
- Hamburger closes on link tap, current-page tap, outside tap, wheel/scroll, swipe and browser navigation.
- `/locations` redirects to My Assets.

## 3. Public serial check

- No “Free public lookup,” demo serial or “safe” wording appears.
- Invalid, too-short and overlong serials show friendly messages.
- Results expose no owner name, email, exact address, document URL or internal UUID.
- Test each result state: no record, registered, for sale, transfer pending, stolen, recovered and disputed.
- Expired For sale status is not displayed publicly.
- Repeated checks reach a friendly 429 response during an agreed staging test.

## 4. Seller-control confirmation

- Buyer generates a six-digit challenge from a registered result.
- Wrong seller account cannot confirm it.
- Correct asset owner can enter the code from Asset details.
- Buyer page changes to “Seller account confirmed just now.”
- Expired and reused codes fail.
- Stolen/disputed records cannot create a challenge.
- No owner identity is shown to the buyer.

## 5. Sale and transfer

- Owner can mark an eligible asset For sale for 14 days and remove the status.
- Stolen or transfer-pending assets cannot be marked For sale.
- New transfer code is 12 characters, shown once, and accepted with or without dashes.
- Database stores only the hash plus a masked display value.
- Creating a new transfer cancels an older pending transfer.
- Preview shows make, model, category, masked serial and expiry only.
- Self-claim fails.
- Wrong recipient email fails when the transfer is restricted.
- Expired, cancelled, used and replayed codes fail.
- Two simultaneous claims result in one successful owner change only.
- Accepted transfer moves private photo/document ownership and records an audit event.

## 6. Registration and assets

- Registration has Identify, Strengthen and Review steps.
- Duplicate serial registration fails with a friendly message.
- Image types are limited to JPEG, PNG and WebP and documents to PDF/JPEG/PNG/WebP.
- Oversized or unsupported files are rejected before upload.
- Adding evidence changes record strength to Evidence supplied.
- My Assets Manage menu contains the appropriate import/export tools for the account type.
- Insurance schedule downloads as a readable PDF.
- Asset details show one primary action plus More.

## 7. Theft and sightings

- Reporting stolen requires date, general area and confirmation.
- Public result changes to Reported stolen.
- Sighting form includes source, location, listing URL, seller username, advert title, asking price and private notes.
- Common options include Adverts.ie and DoneDeal; no `avispl.com` placeholder appears.
- Owner receives a notification where enabled.
- Sighting inbox shows the marketplace details and no raw database errors.
- Marking recovered updates the active theft report and public result.
- Theft Evidence Report PDF contains the asset, owner-controlled details, theft information, audit entries, evidence counts and available photographs.

## 8. Shop and account

- Shop cards show image, name, price and Add to basket without duplicate detail buttons.
- Empty Features/Specifications sections do not appear.
- Checkout validates name, email, phone and delivery address before insert.
- Checkout never exposes Postgres/Supabase errors.
- Order request appears in My orders.
- Admin Products and Orders remain separate and hidden from normal users.
- Account is one scrolling page with Profile, Account type, Notifications, related areas, Security and Delete account.

## 9. Security release gate

Complete every test in `SECURITY-V4.5.md`, especially cross-account database and Storage access. Do not enable live payments or invite unrestricted public uploads until the recorded High-risk tests pass.
