import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Shop backend is not configured." }, { status: 503 });
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const search = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  let query = admin.from("shop_products").select("id, sku, slug, name, description, category, price_cents, compare_at_price_cents, currency, stock_quantity, image_url, active, featured").eq("active", true).order("featured", { ascending: false }).order("name");
  if (category) query = query.eq("category", category);
  if (search) query = query.or(`name.ilike.%${search.replace(/[%_,]/g, "")}%,description.ilike.%${search.replace(/[%_,]/g, "")}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
