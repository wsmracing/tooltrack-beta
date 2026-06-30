import { NextRequest, NextResponse } from "next/server";
import { getDemoLookup } from "@/lib/demo-data";
import { maskSerial, normaliseSerial } from "@/lib/normalise";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { PublicLookupResult } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rawSerial = request.nextUrl.searchParams.get("serial") ?? "";
  const serial = normaliseSerial(rawSerial);
  if (!serial) return NextResponse.json({ error: "Serial number is required." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("assets")
      .select("id, make, model, category, serial_original, status, registered_at")
      .eq("serial_normalized", serial)
      .maybeSingle();

    if (!error && data) {
      let reportedAt: string | undefined;
      let locationArea: string | undefined;
      let publicReference: string | undefined;
      if (data.status === "stolen") {
        const { data: theft } = await admin
          .from("theft_reports")
          .select("reported_at, location_area, public_reference")
          .eq("asset_id", data.id)
          .is("recovered_at", null)
          .order("reported_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        reportedAt = theft?.reported_at;
        locationArea = theft?.location_area;
        publicReference = theft?.public_reference;
      }

      const result: PublicLookupResult = {
        found: true,
        status: data.status,
        make: data.make,
        model: data.model,
        category: data.category,
        serialMasked: maskSerial(data.serial_original),
        registeredAt: data.registered_at,
        reportedAt,
        locationArea,
        publicReference,
        message: data.status === "stolen"
          ? "This asset has been reported stolen. Do not purchase it."
          : data.status === "transfer"
            ? "This asset is registered and an ownership transfer is pending."
            : "This asset is registered and is not currently marked as stolen.",
      };
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  }

  const demo = getDemoLookup(serial);
  if (demo) return NextResponse.json(demo, { headers: { "Cache-Control": "no-store" } });

  const none: PublicLookupResult = {
    found: false,
    status: "none",
    message: "No asset with this serial number is currently recorded as stolen on ToolTrack.",
  };
  return NextResponse.json(none, { headers: { "Cache-Control": "no-store" } });
}
