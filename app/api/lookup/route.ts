import { NextRequest, NextResponse } from "next/server";
import { maskSerial, normaliseSerial } from "@/lib/normalise";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { authenticatedUser } from "@/lib/server-auth";
import type { AssetStatus, MarketStatus, PublicLookupResult, PublicLookupState, VerificationLevel } from "@/lib/types";

export const runtime = "nodejs";

function response(result: PublicLookupResult, status = 200) {
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function GET(request: NextRequest) {
  const ip = requestIp(request.headers);
  const rate = await checkRateLimit(`lookup:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many checks. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)), "Cache-Control": "no-store" } });
  }

  const rawSerial = request.nextUrl.searchParams.get("serial") ?? "";
  if (rawSerial.length > 96 || !/^[a-zA-Z0-9\s._\-/]*$/.test(rawSerial)) {
    return NextResponse.json({ error: "Enter a valid serial number." }, { status: 400 });
  }
  const serial = normaliseSerial(rawSerial);
  if (serial.length < 4 || serial.length > 64) {
    return NextResponse.json({ error: "Serial numbers must contain between 4 and 64 letters or numbers." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "The serial checker is temporarily unavailable." }, { status: 503 });

  const { data, error } = await admin
    .from("assets")
    .select("id, owner_id, make, model, category, serial_original, status, market_status, sale_expires_at, verification_level, registered_at")
    .eq("serial_normalized", serial)
    .order("registered_at", { ascending: true })
    .limit(2);

  if (error) return NextResponse.json({ error: "The serial checker is temporarily unavailable." }, { status: 503 });

  if (!data?.length) {
    return response({
      found: false,
      status: "none",
      lookupState: "none",
      message: "No matching asset record was found on ToolTrack.",
    });
  }

  const asset = data[0];
  const auth = await authenticatedUser(request);
  const ownedByCurrentUser = Boolean(auth?.user?.id && auth.user.id === asset.owner_id);
  const duplicate = data.length > 1;
  const status = asset.status as AssetStatus;
  const verificationLevel = (asset.verification_level ?? "registered") as VerificationLevel;
  const saleActive = asset.market_status === "for_sale" && (!asset.sale_expires_at || new Date(asset.sale_expires_at).getTime() > Date.now());
  const marketStatus = (duplicate || asset.market_status === "disputed" || verificationLevel === "disputed") ? "disputed" : saleActive ? "for_sale" : "not_for_sale" as MarketStatus;

  let lookupState: PublicLookupState = "registered";
  let message = ownedByCurrentUser
    ? "This asset is registered to your account."
    : "This asset is registered. Ask the seller to confirm control of the ToolTrack record before paying.";

  if (marketStatus === "disputed") {
    lookupState = "disputed";
    message = "This registration is disputed. Do not purchase until the record has been resolved.";
  } else if (status === "stolen") {
    lookupState = "stolen";
    message = "This asset has been reported stolen. Do not purchase it.";
  } else if (status === "transfer") {
    lookupState = "transfer_pending";
    message = "A ToolTrack ownership transfer is already pending for this asset.";
  } else if (saleActive) {
    lookupState = "for_sale";
    message = "The registered account holder has recently marked this asset for sale.";
  } else if (status === "recovered") {
    lookupState = "recovered";
    message = "This asset was previously reported stolen and later marked recovered. Confirm the seller before paying.";
  }

  if (ownedByCurrentUser) {
    message = status === "stolen"
      ? "This stolen asset report belongs to your account."
      : "This asset is registered to your account.";
  }

  let reportedAt: string | undefined;
  let locationArea: string | undefined;
  let publicReference: string | undefined;
  if (status === "stolen") {
    const { data: theft } = await admin
      .from("theft_reports")
      .select("reported_at, location_area, public_reference")
      .eq("asset_id", asset.id)
      .is("recovered_at", null)
      .order("reported_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    reportedAt = theft?.reported_at;
    locationArea = theft?.location_area;
    publicReference = theft?.public_reference;
  }

  return response({
    found: true,
    status,
    lookupState,
    make: asset.make,
    model: asset.model,
    category: asset.category,
    serialMasked: maskSerial(asset.serial_original),
    registeredAt: asset.registered_at,
    marketStatus,
    saleExpiresAt: saleActive ? asset.sale_expires_at ?? undefined : undefined,
    verificationLevel,
    reportedAt,
    locationArea,
    publicReference,
    message,
    ownedByCurrentUser,
    assetId: ownedByCurrentUser ? asset.id : undefined,
  });
}
