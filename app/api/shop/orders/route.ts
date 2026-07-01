import { NextRequest, NextResponse } from "next/server";
import { authenticateShopRequest } from "@/lib/shop-server";

export const runtime = "nodejs";

type OrderBody = {
  items?: Array<{ productId?: string; quantity?: number }>;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  notes?: string;
};

export async function GET(request: NextRequest) {
  const { admin, user, error } = await authenticateShopRequest(request.headers.get("authorization"));
  if (!admin || !user) return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 500 });
  const { data, error: queryError } = await admin.from("shop_orders").select("id, order_number, status, payment_status, subtotal_cents, shipping_cents, total_cents, currency, created_at, shop_order_items(id, sku, product_name, unit_price_cents, quantity, line_total_cents)").eq("user_id", user.id).order("created_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, user, error } = await authenticateShopRequest(request.headers.get("authorization"));
  if (!admin || !user) return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 500 });
  const body = await request.json() as OrderBody;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const quantities = new Map<string, number>();
  for (const item of rawItems) {
    const id = item.productId?.trim();
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(item.quantity ?? 1))));
    if (id) quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  }
  if (!quantities.size) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  const contactName = body.contactName?.trim().slice(0, 120);
  const contactEmail = body.contactEmail?.trim().toLowerCase().slice(0, 200);
  const address1 = body.address1?.trim().slice(0, 200);
  const city = body.city?.trim().slice(0, 120);
  const county = body.county?.trim().slice(0, 120);
  if (!contactName || !contactEmail || !address1 || !city || !county) return NextResponse.json({ error: "Name, email and delivery address are required." }, { status: 400 });

  const ids = Array.from(quantities.keys());
  const { data: products, error: productError } = await admin.from("shop_products").select("id, sku, name, price_cents, currency, stock_quantity, active").in("id", ids).eq("active", true);
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
  if ((products ?? []).length !== ids.length) return NextResponse.json({ error: "One or more products are no longer available." }, { status: 400 });

  let subtotal = 0;
  const lines = (products ?? []).map((product) => {
    const quantity = quantities.get(product.id) ?? 1;
    if (product.stock_quantity < quantity) throw new Error(`${product.name} does not have enough stock.`);
    const lineTotal = product.price_cents * quantity;
    subtotal += lineTotal;
    return { product_id: product.id, sku: product.sku, product_name: product.name, unit_price_cents: product.price_cents, quantity, line_total_cents: lineTotal };
  });

  const shipping = 0;
  const { data: order, error: orderError } = await admin.from("shop_orders").insert({
    user_id: user.id,
    subtotal_cents: subtotal,
    shipping_cents: shipping,
    total_cents: subtotal + shipping,
    currency: "EUR",
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: body.contactPhone?.trim().slice(0, 60) || null,
    shipping_address: { address1, address2: body.address2?.trim().slice(0, 200) || null, city, county, postcode: body.postcode?.trim().slice(0, 40) || null, country: "Ireland" },
    notes: body.notes?.trim().slice(0, 1000) || null,
    status: "beta_pending",
    payment_status: "not_charged",
  }).select("id, order_number, total_cents, currency, status").single();
  if (orderError || !order) return NextResponse.json({ error: orderError?.message ?? "Could not create order." }, { status: 500 });
  const { error: lineError } = await admin.from("shop_order_items").insert(lines.map((line) => ({ ...line, order_id: order.id })));
  if (lineError) { await admin.from("shop_orders").delete().eq("id", order.id); return NextResponse.json({ error: lineError.message }, { status: 500 }); }
  return NextResponse.json({ order, message: "Beta order created. No payment has been taken." }, { status: 201 });
}
