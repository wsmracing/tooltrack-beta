# ToolTrack V4.4 test pass

## Mobile navigation
- Person icon opens Account.
- Bottom bar contains Home, Lookup, Assets and Add only.
- Hamburger contains Team, Claim transferred asset, My orders, Shop, Help and Log out.
- Menu closes after selecting the current page, selecting another page, tapping outside, scrolling or swiping.

## Dashboard and homepage
- Dashboard shows summary, new sightings and recent assets without duplicate quick-action cards.
- Homepage lookup remains centred and has one clear registration action.

## Shop
- Add products to the basket.
- Complete contact and delivery details.
- Create an order without a raw database error.
- View the order under Account → Orders.
- In Shop Admin, switch between Products and Orders.
- Change an order through every status and confirm the dropdown reverts if saving fails.

## Transfers and invitations
- My Assets shows Claim asset.
- A transfer code can be entered manually, with or without the dash.
- Asset details are previewed before acceptance.
- Create a new team invitation and confirm the email link uses the active deployment domain.

## Analytics
- Vercel Web Analytics remains installed.
- Query strings and hashes are stripped before analytics events are sent.
