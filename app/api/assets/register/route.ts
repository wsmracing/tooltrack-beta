import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { displaySerial, normaliseSerial } from "@/lib/normalise";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function numberOrNull(value: unknown) { const parsed = Number(value); return value !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(`asset-register:${requestIp(request.headers)}`, 30, 60 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Asset registration is temporarily unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const make = text(body.make, 100);
  const model = text(body.model, 120);
  const category = text(body.category, 100);
  const serialOriginal = displaySerial(text(body.serial, 96));
  const serialNormalized = normaliseSerial(serialOriginal);
  if (!make || !model || !category || serialNormalized.length < 4) return NextResponse.json({ error: "Make, model, category and a valid serial number are required." }, { status: 400 });

  const { data: duplicate } = await admin.from("assets").select("id").eq("serial_normalized", serialNormalized).limit(1).maybeSingle();
  if (duplicate) return NextResponse.json({ error: "This serial number already has a ToolTrack record. Check the serial or use the dispute process if you believe the record is wrong." }, { status: 409 });

  const { data: profile } = await admin.from("profiles").select("active_organization_id").eq("id", auth.user.id).maybeSingle();
  const storageLocation = text(body.storageLocation, 160) || null;
  let locationId: string | null = null;
  if (storageLocation) {
    const { data: location } = await admin.from("asset_locations").select("id").eq("owner_id", auth.user.id).eq("name", storageLocation).maybeSingle();
    locationId = location?.id ?? null;
  }

  const { data: asset, error } = await admin.from("assets").insert({
    owner_id: auth.user.id,
    organization_id: profile?.active_organization_id ?? null,
    make,
    model,
    category,
    serial_original: serialOriginal,
    serial_normalized: serialNormalized,
    secondary_identifier: text(body.secondaryIdentifier, 120) || null,
    colour: text(body.colour, 80) || null,
    storage_location: storageLocation,
    location_id: locationId,
    estimated_value: numberOrNull(body.estimatedValue),
    supplier: text(body.supplier, 160) || null,
    purchase_date: text(body.purchaseDate, 10) || null,
    purchase_price: numberOrNull(body.purchasePrice),
    invoice_number: text(body.invoiceNumber, 120) || null,
    security_id: text(body.securityId, 160) || null,
    catalogue_item_id: text(body.catalogueItemId, 64) || null,
    product_barcode: text(body.productBarcode, 80) || null,
    status: "safe",
    market_status: "not_for_sale",
    verification_level: "registered",
  }).select("id").single();

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("serial_already_registered") || message.includes("duplicate")) return NextResponse.json({ error: "This serial number already has a ToolTrack record." }, { status: 409 });
    if (message.includes("plan allows")) return NextResponse.json({ error: "Your current account has reached its asset limit." }, { status: 400 });
    return NextResponse.json({ error: "The asset could not be registered. Check the details and try again." }, { status: 400 });
  }
  return NextResponse.json({ id: asset.id }, { status: 201 });
}
