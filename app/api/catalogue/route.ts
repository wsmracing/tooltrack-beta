import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function cleanSearch(value: string) {
  return value.trim().toLowerCase().replace(/[%_]/g, "").slice(0, 100);
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Product catalogue is not configured yet." }, { status: 503 });
  }

  const barcode = request.nextUrl.searchParams.get("barcode")?.trim().replace(/\s+/g, "").slice(0, 80) ?? "";
  const query = cleanSearch(request.nextUrl.searchParams.get("q") ?? "");

  if (barcode) {
    const { data, error } = await admin
      .from("product_catalogue")
      .select("id, catalogue_key, make, model, category, manufacturer_part_number, gtin, power_type, voltage, source")
      .eq("gtin", barcode)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      const migrationMissing = error.message.toLowerCase().includes("product_catalogue");
      return NextResponse.json(
        { error: migrationMissing ? "The V3.3 catalogue migration still needs to be installed." : "Could not search the product catalogue." },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: data ?? null });
  }

  if (query.length < 2) return NextResponse.json({ items: [] });

  const { data, error } = await admin
    .from("product_catalogue")
    .select("id, catalogue_key, make, model, category, manufacturer_part_number, gtin, power_type, voltage, source")
    .eq("is_active", true)
    .ilike("search_text", `%${query}%`)
    .order("make", { ascending: true })
    .order("model", { ascending: true })
    .limit(12);

  if (error) {
    const migrationMissing = error.message.toLowerCase().includes("product_catalogue");
    return NextResponse.json(
      { error: migrationMissing ? "The V3.3 catalogue migration still needs to be installed." : "Could not search the product catalogue." },
      { status: 500 },
    );
  }

  return NextResponse.json({ items: data ?? [] });
}
