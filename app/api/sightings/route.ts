import { NextRequest, NextResponse } from "next/server";
import { normaliseSerial } from "@/lib/normalise";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type SightingPayload = {
  serial?: unknown;
  locationArea?: unknown;
  details?: unknown;
  listingUrl?: unknown;
  reporterEmail?: unknown;
  website?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  let payload: SightingPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid sighting report." }, { status: 400 });
  }

  // Quietly accept bot submissions that fill the hidden honeypot field.
  if (cleanText(payload.website, 200)) {
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const serial = normaliseSerial(cleanText(payload.serial, 120));
  const locationArea = cleanText(payload.locationArea, 160);
  const details = cleanText(payload.details, 1500);
  const listingUrl = cleanText(payload.listingUrl, 500) || null;
  const reporterEmail = cleanText(payload.reporterEmail, 254).toLowerCase() || null;

  if (!serial || !locationArea || !details) {
    return NextResponse.json(
      { error: "Serial number, location and sighting details are required." },
      { status: 400 },
    );
  }

  if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
    return NextResponse.json({ error: "Enter a valid email address or leave it blank." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Sighting reports are not configured yet." }, { status: 503 });
  }

  const { data: asset, error: assetError } = await admin
    .from("assets")
    .select("id")
    .eq("serial_normalized", serial)
    .eq("status", "stolen")
    .maybeSingle();

  if (assetError) {
    return NextResponse.json({ error: "Could not verify the stolen asset." }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json({ error: "No active stolen report was found for this serial number." }, { status: 404 });
  }

  const { data: theftReport, error: theftError } = await admin
    .from("theft_reports")
    .select("id")
    .eq("asset_id", asset.id)
    .is("recovered_at", null)
    .order("reported_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (theftError || !theftReport) {
    return NextResponse.json({ error: "The active theft report could not be found." }, { status: 404 });
  }

  const { error: insertError } = await admin.from("sightings").insert({
    asset_id: asset.id,
    theft_report_id: theftReport.id,
    reporter_email: reporterEmail,
    location_area: locationArea,
    listing_url: listingUrl,
    details,
  });

  if (insertError) {
    const missingTable = insertError.message.toLowerCase().includes("sightings");
    return NextResponse.json(
      { error: missingTable ? "The sightings database update still needs to be installed." : "Could not save the sighting report." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { success: true, message: "Thank you. The sighting has been recorded for the asset owner to review." },
    { status: 201 },
  );
}
