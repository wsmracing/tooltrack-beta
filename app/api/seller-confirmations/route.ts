import { createHash, randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/server-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normaliseSerial } from "@/lib/normalise";

export const runtime = "nodejs";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request.headers);
  if (!checkRateLimit(`seller-confirmation-create:${ip}`, 8, 60_000).allowed) {
    return NextResponse.json({ error: "Too many confirmation requests. Wait a minute and try again." }, { status: 429 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Seller confirmation is temporarily unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { serial?: unknown };
  const serial = normaliseSerial(typeof body.serial === "string" ? body.serial : "");
  if (serial.length < 4 || serial.length > 64) return NextResponse.json({ error: "Enter a valid serial number." }, { status: 400 });

  const { data: asset } = await admin.from("assets").select("id, status, market_status").eq("serial_normalized", serial).limit(1).maybeSingle();
  if (!asset || asset.status === "stolen" || asset.market_status === "disputed") {
    return NextResponse.json({ error: "Seller confirmation is not available for this record." }, { status: 400 });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const publicToken = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error } = await admin.from("seller_confirmation_challenges").insert({
    asset_id: asset.id,
    challenge_code_hash: hash(code),
    public_token: publicToken,
    status: "pending",
    expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: "The confirmation request could not be created." }, { status: 400 });
  return NextResponse.json({ code, token: publicToken, expiresAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Seller confirmation is temporarily unavailable." }, { status: 503 });
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Confirmation token is required." }, { status: 400 });
  const { data } = await admin.from("seller_confirmation_challenges").select("status, expires_at, confirmed_at").eq("public_token", token).maybeSingle();
  if (!data) return NextResponse.json({ status: "expired" }, { headers: { "Cache-Control": "no-store" } });
  const status = data.status === "pending" && new Date(data.expires_at).getTime() <= Date.now() ? "expired" : data.status;
  return NextResponse.json({ status, expiresAt: data.expires_at, confirmedAt: data.confirmed_at }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Seller confirmation is temporarily unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { assetId?: unknown; code?: unknown };
  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, 6) : "";
  if (!assetId || code.length !== 6) return NextResponse.json({ error: "Enter the six-digit buyer code." }, { status: 400 });

  const { data: asset } = await admin.from("assets").select("id, owner_id, organization_id").eq("id", assetId).maybeSingle();
  if (!asset || asset.owner_id !== auth.user.id) return NextResponse.json({ error: "Only the registered account holder can confirm this check." }, { status: 403 });

  const { data: challenge } = await admin
    .from("seller_confirmation_challenges")
    .select("id, expires_at")
    .eq("asset_id", assetId)
    .eq("challenge_code_hash", hash(code))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!challenge) return NextResponse.json({ error: "That confirmation code is invalid or has expired." }, { status: 400 });

  const confirmedAt = new Date().toISOString();
  await admin.from("seller_confirmation_challenges").update({ status: "confirmed", confirmed_at: confirmedAt, confirmed_by: auth.user.id }).eq("id", challenge.id).eq("status", "pending");
  await admin.from("asset_audit_log").insert({ asset_id: assetId, actor_id: auth.user.id, action: "seller_check_confirmed", changes: { confirmed_at: confirmedAt } });
  return NextResponse.json({ message: "Buyer check confirmed." });
}
