import { NextRequest, NextResponse } from "next/server";
import { authenticateShopRequest } from "@/lib/shop-server";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";

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
  country?: string;
  notes?: string;
};

function betaError(message: string, status = 500, debug?: string) {
  return NextResponse.json(
    {
      error: message,
      debug: debug || message,
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  const { admin, user, error } = await authenticateShopRequest(request.headers.get("authorization"));
  if (!admin || !user) return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 500 });
  const { data, error: queryError } = await admin
    .from("shop_orders")
    .select("id, order_number, status, payment_status, subtotal_cents, delivery_cents, total_cents, currency, created_at, shop_order_items(id, product_name, unit_price_cents, quantity, line_total_cents)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (queryError) return betaError("Orders could not be loaded.", 500, queryError.message);
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, user, error } = await authenticateShopRequest(request.headers.get("authorization"));
  if (!admin || !user) return betaError(error || "Sign in required.", error === "Sign in required." ? 401 : 500);
  if (!user.email_confirmed_at) return betaError("Verify your email address before placing an order.", 403, "The signed-in user's email address is not verified.");

  let body: OrderBody;
  try {
    body = await request.json() as OrderBody;
  } catch {
    return betaError("The order request was not valid JSON.", 400);
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const quantities = new Map<string, number>();
  for (const item of rawItems) {
    const id = item.productId?.trim();
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(item.quantity ?? 1))));
    if (id) quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  }
  if (!quantities.size) return betaError("Your basket is empty.", 400);

  const contactName = body.contactName?.trim().slice(0, 120);
  const contactEmail = body.contactEmail?.trim().toLowerCase().slice(0, 200);
  const address1 = body.address1?.trim().slice(0, 200);
  const city = body.city?.trim().slice(0, 120);
  const county = body.county?.trim().slice(0, 120);
  const contactPhone = body.contactPhone?.trim().slice(0, 60) || null;
  if (!contactName || !contactEmail || !contactPhone || !address1 || !city || !county) {
    return betaError("Name, email, phone and delivery address are required.", 400);
  }

  const ids = Array.from(quantities.keys());
  const { data: products, error: productError } = await admin
    .from("shop_products")
    .select("id, sku, name, price_cents, sale_price_cents, currency, stock_quantity, is_active")
    .in("id", ids)
    .eq("is_active", true);
  if (productError) return betaError("Products could not be checked.", 500, productError.message);
  if ((products ?? []).length !== ids.length) return betaError("One or more products are no longer available.", 400, `Expected ${ids.length} active products, found ${(products ?? []).length}.`);

  let subtotal = 0;
  const lines = [];
  for (const product of products ?? []) {
    const quantity = quantities.get(product.id) ?? 1;
    if (product.stock_quantity < quantity) return betaError(`${product.name} does not have enough stock.`, 400, `Stock ${product.stock_quantity}, requested ${quantity}.`);
    const unitPrice = product.sale_price_cents !== null && product.sale_price_cents < product.price_cents ? product.sale_price_cents : product.price_cents;
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    lines.push({ product_id: product.id, sku: product.sku || `TT-${product.id}`, product_name: product.name, unit_price_cents: unitPrice, quantity, line_total_cents: lineTotal });
  }

  const orderNumber = "TT-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const { data: order, error: orderError } = await admin.from("shop_orders").insert({
    user_id: user.id,
    order_number: orderNumber,
    subtotal_cents: subtotal,
    delivery_cents: 0,
    total_cents: subtotal,
    currency: "EUR",
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    delivery_address: {
      address1,
      address2: body.address2?.trim().slice(0, 200) || null,
      city,
      county,
      postcode: body.postcode?.trim().slice(0, 40) || null,
      country: body.country?.trim().slice(0, 80) || "Ireland",
    },
    notes: body.notes?.trim().slice(0, 1000) || null,
    status: "pending",
    payment_status: "not_charged",
  }).select("id, order_number, total_cents, currency, status").single();
  if (orderError || !order) return betaError("The order could not be created.", 500, orderError?.message ?? "No order was returned after insert.");

  const { error: lineError } = await admin.from("shop_order_items").insert(lines.map((line) => ({ ...line, order_id: order.id })));
  if (lineError) {
    await admin.from("shop_orders").delete().eq("id", order.id);
    return betaError("The order items could not be created.", 500, lineError.message);
  }

  for (const line of lines) {
    const { error: stockError } = await admin.rpc("decrement_shop_stock", { p_product_id: line.product_id, p_quantity: line.quantity });
    if (stockError) {
      const { data: currentProduct } = await admin.from("shop_products").select("stock_quantity").eq("id", line.product_id).single();
      const nextStock = Math.max(0, Number(currentProduct?.stock_quantity ?? 0) - line.quantity);
      const { error: fallbackStockError } = await admin.from("shop_products").update({ stock_quantity: nextStock, updated_at: new Date().toISOString() }).eq("id", line.product_id);
      if (fallbackStockError) return betaError("The order was created, but stock could not be updated.", 500, `${stockError.message}; fallback: ${fallbackStockError.message}`);
    }
  }

  const total = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(order.total_cents / 100);
  const adminRecipients = (process.env.SHOP_ADMIN_EMAILS ?? "support@tooltrack.ie").split(",").map((value) => value.trim()).filter(Boolean);
  const customerEmail = await sendToolTrackEmail({
    kind: "shop",
    to: contactEmail,
    subject: `ToolTrack order ${order.order_number} received`,
    idempotencyKey: `shop-order-customer-${order.id}`,
    text: `Your ToolTrack beta order ${order.order_number} has been received. Total: ${total}. No payment has been taken.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171717"><div style="border-top:6px solid #d71920;padding-top:20px"><h1>Order received</h1><p>Thanks ${escapeEmailHtml(contactName)}. Your ToolTrack beta order <strong>${escapeEmailHtml(order.order_number)}</strong> has been received.</p><p><strong>Total:</strong> ${escapeEmailHtml(total)}</p><p>No payment has been taken. We will contact you before processing the order.</p></div></div>`,
  });
  await Promise.all(adminRecipients.map((recipient) => sendToolTrackEmail({
    kind: "shop",
    to: recipient,
    subject: `New ToolTrack shop order ${order.order_number}`,
    idempotencyKey: `shop-order-admin-${order.id}-${recipient.toLowerCase()}`,
    text: `New beta shop order ${order.order_number} from ${contactName} (${contactEmail}). Total: ${total}.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171717"><div style="border-top:6px solid #d71920;padding-top:20px"><h1>New shop order</h1><p><strong>Order:</strong> ${escapeEmailHtml(order.order_number)}</p><p><strong>Customer:</strong> ${escapeEmailHtml(contactName)} (${escapeEmailHtml(contactEmail)})</p><p><strong>Total:</strong> ${escapeEmailHtml(total)}</p></div></div>`,
  })));

  return NextResponse.json({ order, emailStatus: customerEmail.status, emailError: customerEmail.error, message: "Beta order created. No payment has been taken." }, { status: 201 });
}
