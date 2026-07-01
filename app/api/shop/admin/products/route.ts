import { NextRequest, NextResponse } from "next/server";
import { authenticateShopRequest, isShopAdmin } from "@/lib/shop-server";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateShopRequest(request.headers.get("authorization"));
  if (!auth.admin || !auth.user) return { ...auth, allowed: false };
  return { ...auth, allowed: await isShopAdmin(auth.user) };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.admin || !auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  if (!auth.allowed) return NextResponse.json({ error: "Shop administrator access required." }, { status: 403 });
  const { data, error } = await auth.admin.from("shop_products").select("*").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ products: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.admin || !auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  if (!auth.allowed) return NextResponse.json({ error: "Shop administrator access required." }, { status: 403 });
  const body = await request.json();
  const payload = {
    sku: String(body.sku ?? "").trim().toUpperCase(), slug: String(body.slug ?? "").trim().toLowerCase(), name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim() || null, category: String(body.category ?? "Other").trim(), price_cents: Math.round(Number(body.price ?? 0) * 100),
    compare_at_price_cents: body.compareAtPrice ? Math.round(Number(body.compareAtPrice) * 100) : null, stock_quantity: Math.max(0, Math.floor(Number(body.stockQuantity ?? 0))),
    image_url: String(body.imageUrl ?? "").trim() || null, active: body.active !== false, featured: body.featured === true,
  };
  if (!payload.sku || !payload.slug || !payload.name || payload.price_cents < 0) return NextResponse.json({ error: "SKU, slug, name and valid price are required." }, { status: 400 });
  const { data, error } = await auth.admin.from("shop_products").insert(payload).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.admin || !auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  if (!auth.allowed) return NextResponse.json({ error: "Shop administrator access required." }, { status: 403 });
  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Product id is required." }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["name", "description", "category", "image_url", "active", "featured", "stock_quantity"] as const) if (body[key] !== undefined) updates[key] = body[key];
  if (body.price !== undefined) updates.price_cents = Math.round(Number(body.price) * 100);
  const { data, error } = await auth.admin.from("shop_products").update(updates).eq("id", id).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ product: data });
}
