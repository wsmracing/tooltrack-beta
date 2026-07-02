import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getPublicAppUrl } from "@/lib/app-url";
import { authenticatedUser } from "@/lib/server-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function makeCode() {
  const bytes = randomBytes(12);
  const clean = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

function hashCode(code: string) {
  return createHash("sha256").update(code.replace(/[^A-Z0-9]/gi, "").toUpperCase()).digest("hex");
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request.headers);
  if (!checkRateLimit(`transfer-create:${ip}`, 10, 60 * 60_000).allowed) return NextResponse.json({ error: "Too many transfer requests. Try again later." }, { status: 429 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Transfer service is temporarily unavailable." }, { status: 503 });
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { assetId?: string; recipientEmail?: string };
  if (!body.assetId) return NextResponse.json({ error: "Asset is required." }, { status: 400 });

  const { data: asset } = await admin.from("assets").select("id, owner_id, make, model, serial_original, status").eq("id", body.assetId).maybeSingle();
  if (!asset || asset.owner_id !== auth.user.id) return NextResponse.json({ error: "Only the registered account holder can create a transfer." }, { status: 403 });
  if (asset.status === "stolen") return NextResponse.json({ error: "A stolen asset cannot be transferred." }, { status: 400 });

  await admin.from("ownership_transfers").update({ status: "cancelled" }).eq("asset_id", asset.id).eq("status", "pending");
  const code = makeCode();
  const clean = code.replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const recipientEmail = body.recipientEmail?.trim().toLowerCase() || null;
  const { data: transfer, error: transferError } = await admin.from("ownership_transfers").insert({
    asset_id: asset.id,
    from_owner_id: auth.user.id,
    recipient_email: recipientEmail,
    transfer_code: `••••-••••-${clean.slice(-4)}`,
    transfer_code_hash: hashCode(code),
    transfer_code_hint: clean.slice(-4),
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (transferError) return NextResponse.json({ error: "The transfer could not be created." }, { status: 400 });

  await admin.from("assets").update({ status: "transfer", market_status: "not_for_sale", sale_expires_at: null }).eq("id", asset.id);
  await admin.from("asset_audit_log").insert({ asset_id: asset.id, actor_id: auth.user.id, action: "transfer_created", changes: { recipient_restricted: Boolean(recipientEmail), expires_at: expiresAt } });

  let emailStatus = "skipped";
  if (recipientEmail) {
    const appUrl = getPublicAppUrl(request.nextUrl.origin);
    const link = `${appUrl}/transfer?code=${encodeURIComponent(code)}`;
    const result = await sendToolTrackEmail({
      to: recipientEmail,
      subject: `${asset.make} ${asset.model} is ready to transfer on ToolTrack`,
      idempotencyKey: `asset-transfer-${transfer.id}`,
      text: `Transfer code: ${code}. Accept: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1 style="color:#d71920">ToolTrack asset transfer</h1><p>The registered account holder has started a transfer for <strong>${escapeEmailHtml(asset.make)} ${escapeEmailHtml(asset.model)}</strong>.</p><p>Serial: <strong>${escapeEmailHtml(asset.serial_original)}</strong></p><p>Transfer code: <strong style="font-size:22px">${escapeEmailHtml(code)}</strong></p><p><a href="${escapeEmailHtml(link)}" style="display:inline-block;background:#d71920;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Review transfer</a></p><p style="color:#666;font-size:13px">Verify the item and seller before paying. A ToolTrack transfer is an evidence trail, not a guarantee of legal ownership.</p></div>`,
    });
    emailStatus = result.status;
    await admin.from("ownership_transfers").update({ email_status: result.status, email_provider_id: result.providerId, email_error: result.error }).eq("id", transfer.id);
  }
  return NextResponse.json({ code, expiresAt, emailStatus });
}
