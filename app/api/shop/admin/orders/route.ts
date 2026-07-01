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
  const { data, error } = await auth.admin.from("shop_orders").select("*, shop_order_items(*)").order("created_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.admin || !auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  if (!auth.allowed) return NextResponse.json({ error: "Shop administrator access required." }, { status: 403 });
  const body = await request.json();
  const statuses = ["beta_pending", "pending_payment", "paid", "processing", "shipped", "completed", "cancelled"];
  if (!body.id || !statuses.includes(body.status)) return NextResponse.json({ error: "Valid order and status are required." }, { status: 400 });
  const { data, error } = await auth.admin.from("shop_orders").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.id).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ order: data });
}
