import { createHash, randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/server-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normaliseSerial } from "@/lib/normalise";

export const runtime = "nodejs";

const CONFIRMATION_CODE_LENGTH = 8;
const MAX_CONFIRMATION_FAILURES = 5;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request.headers);
  const rate = await checkRateLimit(`seller-confirmation-create:${ip}`, 8, 60_000);
  if (!rate.allowed) {
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

  const now = new Date().toISOString();
  await admin.from("seller_confirmation_challenges").delete().eq("asset_id", asset.id).eq("status", "pending").lt("expires_at", now);
  const { data: existing } = await admin.from("seller_confirmation_challenges").select("id").eq("asset_id", asset.id).eq("status", "pending").gt("expires_at", now).is("locked_at", null).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ error: "A seller confirmation check is already pending for this asset." }, { status: 409 });

  const code = String(randomInt(0, 100_000_000)).padStart(CONFIRMATION_CODE_LENGTH, "0");
  const publicToken = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error } = await admin.from("seller_confirmation_challenges").insert({
    asset_id: asset.id,
    challenge_code_hash: hash(code),
    public_token: publicToken,
    status: "pending",
    expires_at: expiresAt,
    failed_attempts: 0,
    locked_at: null,
  });
  if (error) return NextResponse.json({ error: "The confirmation request could not be created." }, { status: 400 });
  return NextResponse.json({ code, token: publicToken, expiresAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Seller confirmation is temporarily unavailable." }, { status: 503 });
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Confirmation token is required." }, { status: 400 });
  const { data } = await admin.from("seller_confirmation_challenges").select("status, expires_at, confirmed_at, locked_at").eq("public_token", token).maybeSingle();
  if (!data) return NextResponse.json({ status: "expired" }, { headers: { "Cache-Control": "no-store" } });
  const status = data.locked_at ? "locked" : data.status === "pending" && new Date(data.expires_at).getTime() <= Date.now() ? "expired" : data.status;
  return NextResponse.json({ status, expiresAt: data.expires_at, confirmedAt: data.confirmed_at }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Seller confirmation is temporarily unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { assetId?: unknown; code?: unknown };
  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, CONFIRMATION_CODE_LENGTH) : "";
  if (!assetId || code.length !== CONFIRMATION_CODE_LENGTH) return NextResponse.json({ error: `Enter the ${CONFIRMATION_CODE_LENGTH}-digit buyer code.` }, { status: 400 });

  const rate = await checkRateLimit(`seller-confirmation-confirm:${auth.user.id}:${assetId}`, 10, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many confirmation attempts. Wait and try again." }, { status: 429 });

  const { data: asset } = await admin.from("assets").select("id, owner_id, organization_id").eq("id", assetId).maybeSingle();
  if (!asset || asset.owner_id !== auth.user.id) return NextResponse.json({ error: "Only the registered account holder can confirm this check." }, { status: 403 });

  const { data: challenge } = await admin
    .from("seller_confirmation_challenges")
    .select("id, expires_at, challenge_code_hash, failed_attempts, locked_at")
    .eq("asset_id", assetId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!challenge) return NextResponse.json({ error: "That confirmation code is invalid or has expired." }, { status: 400 });
  if (challenge.locked_at) return NextResponse.json({ error: "This confirmation check is locked after too many wrong attempts." }, { status: 423 });
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "That confirmation code is invalid or has expired." }, { status: 400 });

  if (challenge.challenge_code_hash !== hash(code)) {
    const failedAttempts = Number(challenge.failed_attempts ?? 0) + 1;
    const lockedAt = failedAttempts >= MAX_CONFIRMATION_FAILURES ? new Date().toISOString() : null;
    await admin.from("seller_confirmation_challenges").update({ failed_attempts: failedAttempts, locked_at: lockedAt, last_failed_at: new Date().toISOString() }).eq("id", challenge.id).eq("status", "pending").is("locked_at", null);
    return NextResponse.json({ error: lockedAt ? "This confirmation check is locked after too many wrong attempts." : "That confirmation code is invalid or has expired." }, { status: lockedAt ? 423 : 400 });
  }

  const confirmedAt = new Date().toISOString();
  await admin.from("seller_confirmation_challenges").update({ status: "confirmed", confirmed_at: confirmedAt, confirmed_by: auth.user.id }).eq("id", challenge.id).eq("status", "pending").is("locked_at", null);
  await admin.from("asset_audit_log").insert({ asset_id: assetId, actor_id: auth.user.id, action: "seller_check_confirmed", changes: { confirmed_at: confirmedAt } });
  return NextResponse.json({ message: "Buyer check confirmed." });
}
