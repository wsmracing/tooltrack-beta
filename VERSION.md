# ToolTrack V4.7.6

Checkout and logo hotfix.

- Fixes shop checkout failure caused by `shop_order_items.sku` being inserted as null.
- Order item rows now include a SKU from the product record, with a safe fallback.
- Replaces the previous cartoon/shield-style mark with a completely redesigned abstract asset-tag/track logo.
- Keeps the V4.7.5 checkout debug messages for beta testing.
- No Supabase schema changes.
