import { NextRequest, NextResponse } from "next/server";
import { normaliseOptionalUrl, normaliseSerial } from "@/lib/normalise";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";

export const runtime = "nodejs";

type SightingPayload = {
  serial?: unknown;
  locationArea?: unknown;
  details?: unknown;
  listingUrl?: unknown;
  reporterEmail?: unknown;
  website?: unknown;
};

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function rateLimited(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const now = Date.now();
  const existing = rateStore.get(key);
  if (!existing || existing.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  existing.count += 1;
  rateStore.set(key, existing);
  return existing.count > 5;
}

async function sendOwnerEmail({
  to,
  sightingId,
  make,
  model,
  serial,
  locationArea,
  details,
  listingUrl,
  reporterEmail,
}: {
  to: string;
  sightingId: string;
  make: string;
  model: string;
  serial: string;
  locationArea: string;
  details: string;
  listingUrl: string | null;
  reporterEmail: string | null;
}) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const dashboardUrl = appUrl ? `${appUrl}/dashboard#sightings` : "";
  const listingBlock = listingUrl
    ? `<p><strong>Listing:</strong> <a href="${escapeEmailHtml(listingUrl)}">${escapeEmailHtml(listingUrl)}</a></p>`
    : "";
  const reporterBlock = reporterEmail
    ? `<p><strong>Reporter contact:</strong> ${escapeEmailHtml(reporterEmail)}</p>`
    : `<p><strong>Reporter contact:</strong> Not provided</p>`;
  const button = dashboardUrl
    ? `<p style="margin-top:24px"><a href="${escapeEmailHtml(dashboardUrl)}" style="display:inline-block;background:#d71920;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Review sighting in ToolTrack</a></p>`
    : "";

  return sendToolTrackEmail({
    to,
    subject: `New sighting reported for your ${make} ${model}`,
    idempotencyKey: `sighting-${sightingId}`,
    text: `A new sighting was reported for your ${make} ${model}. Location: ${locationArea}. Details: ${details}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171717">
        <div style="border-top:6px solid #d71920;padding-top:20px">
          <h1 style="font-size:24px;margin-bottom:8px">A new sighting was reported</h1>
          <p>Information was submitted about your stolen <strong>${escapeEmailHtml(make)} ${escapeEmailHtml(model)}</strong>.</p>
          <p><strong>Serial:</strong> ${escapeEmailHtml(serial)}</p>
          <p><strong>Reported location:</strong> ${escapeEmailHtml(locationArea)}</p>
          ${listingBlock}
          ${reporterBlock}
          <div style="background:#f5f5f5;border-radius:10px;padding:16px;margin-top:16px;white-space:pre-wrap">${escapeEmailHtml(details)}</div>
          <p style="font-size:13px;color:#666;margin-top:18px">Do not confront anyone. Contact An Garda Síochána where appropriate and verify all information independently.</p>
          ${button}
        </div>
      </div>`,
  });
}

export async function POST(request: NextRequest) {
  let payload: SightingPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid sighting report." }, { status: 400 });
  }

  if (cleanText(payload.website, 200)) {
    return NextResponse.json({ success: true }, { status: 201 });
  }

  if (rateLimited(request)) {
    return NextResponse.json({ error: "Too many reports were submitted. Please wait and try again." }, { status: 429 });
  }

  const serial = normaliseSerial(cleanText(payload.serial, 120));
  const locationArea = cleanText(payload.locationArea, 160);
  const details = cleanText(payload.details, 1500);
  const rawListingUrl = cleanText(payload.listingUrl, 500);
  const listingUrl = rawListingUrl ? normaliseOptionalUrl(rawListingUrl) : null;
  const reporterEmail = cleanText(payload.reporterEmail, 254).toLowerCase() || null;

  if (!serial || !locationArea || !details) {
    return NextResponse.json(
      { error: "Serial number, location and sighting details are required." },
      { status: 400 },
    );
  }

  if (rawListingUrl && !listingUrl) {
    return NextResponse.json({ error: "Enter a valid listing website address or leave it blank." }, { status: 400 });
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
    .select("id, owner_id, make, model, serial_original")
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

  const { data: sighting, error: insertError } = await admin.from("sightings").insert({
    asset_id: asset.id,
    theft_report_id: theftReport.id,
    reporter_email: reporterEmail,
    location_area: locationArea,
    listing_url: listingUrl,
    details,
    notification_status: "pending",
  }).select("id").single();

  if (insertError) {
    const missingTable = insertError.message.toLowerCase().includes("sightings");
    return NextResponse.json(
      { error: missingTable ? "The sightings database update still needs to be installed." : "Could not save the sighting report." },
      { status: 500 },
    );
  }

  let notificationStatus: "sent" | "skipped" | "failed" = "skipped";
  let notificationError: string | null = null;

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("email_sighting_notifications")
      .eq("id", asset.owner_id)
      .maybeSingle();

    if (profile?.email_sighting_notifications === false) {
      notificationStatus = "skipped";
      notificationError = "Owner disabled sighting emails.";
    } else {
      const { data: ownerData, error: ownerError } = await admin.auth.admin.getUserById(asset.owner_id);
      if (ownerError || !ownerData.user?.email) {
        notificationStatus = "failed";
        notificationError = "The owner email address could not be found.";
      } else {
        const emailResult = await sendOwnerEmail({
          to: ownerData.user.email,
          sightingId: sighting.id,
          make: asset.make,
          model: asset.model,
          serial: asset.serial_original,
          locationArea,
          details,
          listingUrl,
          reporterEmail,
        });
        notificationStatus = emailResult.status;
        notificationError = emailResult.error;
        await admin.from("sightings").update({ notification_provider_id: emailResult.providerId }).eq("id", sighting.id);
      }
    }
  } catch (error) {
    notificationStatus = "failed";
    notificationError = error instanceof Error ? error.message.slice(0, 500) : "Email notification failed.";
  }

  await admin.from("sightings").update({
    notification_status: notificationStatus,
    notification_sent_at: notificationStatus === "sent" ? new Date().toISOString() : null,
    notification_error: notificationError,
  }).eq("id", sighting.id);

  return NextResponse.json(
    {
      success: true,
      notificationStatus,
      message: notificationStatus === "sent"
        ? "Thank you. The sighting was recorded and the asset owner was notified."
        : "Thank you. The sighting was recorded for the asset owner to review.",
    },
    { status: 201 },
  );
}
