import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The asset could not be updated." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = text(body.action, 40);
  const { data: asset } = await admin.from("assets").select("id, owner_id, make, model, serial_original, status").eq("id", id).maybeSingle();
  if (!asset || asset.owner_id !== auth.user.id) return NextResponse.json({ error: "Only the registered account holder can complete that action." }, { status: 403 });

  if (action === "report_stolen") {
    if (asset.status === "stolen") return NextResponse.json({ message: "This asset is already marked stolen." });
    const theftDate = text(body.theftDate, 10);
    const locationArea = text(body.locationArea, 160);
    if (!theftDate || !locationArea) return NextResponse.json({ error: "The theft date and general area are required." }, { status: 400 });
    const publicReference = `TT-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const { error: reportError } = await admin.from("theft_reports").insert({
      asset_id: asset.id,
      owner_id: auth.user.id,
      theft_date: theftDate,
      location_area: locationArea,
      police_reference: text(body.gardaReference, 120) || null,
      circumstances: text(body.circumstances, 2000) || null,
      public_reference: publicReference,
    });
    if (reportError) return NextResponse.json({ error: "The stolen report could not be saved." }, { status: 400 });
    await admin.from("assets").update({ status: "stolen", market_status: "not_for_sale", sale_expires_at: null }).eq("id", id);
    await admin.from("asset_audit_log").insert({ asset_id: id, actor_id: auth.user.id, action: "stolen_report_created", changes: { public_reference: publicReference, location_area: locationArea } });
    return NextResponse.json({ message: "This asset now appears as stolen in public checks." });
  }

  if (action === "recover") {
    await admin.from("assets").update({ status: "recovered" }).eq("id", id);
    await admin.from("theft_reports").update({ recovered_at: new Date().toISOString() }).eq("asset_id", id).is("recovered_at", null);
    await admin.from("asset_audit_log").insert({ asset_id: id, actor_id: auth.user.id, action: "asset_recovered", changes: null });
    return NextResponse.json({ message: "Asset marked as recovered." });
  }

  if (action === "mark_for_sale") {
    if (asset.status === "stolen" || asset.status === "transfer") return NextResponse.json({ error: "This asset cannot be marked for sale in its current state." }, { status: 400 });
    const days = Math.min(30, Math.max(1, Number(body.days) || 14));
    const saleExpiresAt = new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
    await admin.from("assets").update({ market_status: "for_sale", sale_expires_at: saleExpiresAt }).eq("id", id);
    await admin.from("asset_audit_log").insert({ asset_id: id, actor_id: auth.user.id, action: "asset_marked_for_sale", changes: { sale_expires_at: saleExpiresAt } });
    return NextResponse.json({ message: `Sale status active for ${days} days.`, saleExpiresAt });
  }

  if (action === "remove_from_sale") {
    await admin.from("assets").update({ market_status: "not_for_sale", sale_expires_at: null }).eq("id", id);
    await admin.from("asset_audit_log").insert({ asset_id: id, actor_id: auth.user.id, action: "sale_status_removed", changes: null });
    return NextResponse.json({ message: "Sale status removed." });
  }

  return NextResponse.json({ error: "Unknown asset action." }, { status: 400 });
}
