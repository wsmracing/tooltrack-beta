import { NextRequest, NextResponse } from "next/server";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getPublicAppUrl } from "@/lib/app-url";

function makeCode() {
  return `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server configuration is incomplete." }, { status: 500 });
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: auth, error: authError } = await admin.auth.getUser(bearer);
  if (authError || !auth.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  const body = await request.json() as { assetId?: string; recipientEmail?: string };
  if (!body.assetId) return NextResponse.json({ error: "Asset is required." }, { status: 400 });
  const { data: asset } = await admin.from("assets").select("id, owner_id, make, model, serial_original, status").eq("id", body.assetId).maybeSingle();
  if (!asset || asset.owner_id !== auth.user.id) return NextResponse.json({ error: "Only the asset owner can create a transfer." }, { status: 403 });
  if (asset.status === "stolen") return NextResponse.json({ error: "A stolen asset cannot be transferred." }, { status: 400 });
  const code = makeCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const recipientEmail = body.recipientEmail?.trim().toLowerCase() || null;
  const { data: transfer, error: transferError } = await admin.from("ownership_transfers").insert({ asset_id: asset.id, from_owner_id: auth.user.id, recipient_email: recipientEmail, transfer_code: code, status: "pending", expires_at: expiresAt }).select("id").single();
  if (transferError) return NextResponse.json({ error: transferError.message }, { status: 400 });
  await admin.from("assets").update({ status: "transfer" }).eq("id", asset.id);
  let emailStatus = "skipped";
  if (recipientEmail) {
    const appUrl = getPublicAppUrl(request.nextUrl.origin);
    const link = `${appUrl}/transfer?code=${encodeURIComponent(code)}`;
    const result = await sendToolTrackEmail({
      to: recipientEmail,
      subject: `${asset.make} ${asset.model} has been transferred to you on ToolTrack`,
      idempotencyKey: `asset-transfer-${transfer.id}`,
      text: `Transfer code: ${code}. Accept: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1 style="color:#d71920">ToolTrack asset transfer</h1><p>An owner has started a transfer for <strong>${escapeEmailHtml(asset.make)} ${escapeEmailHtml(asset.model)}</strong>.</p><p>Serial: <strong>${escapeEmailHtml(asset.serial_original)}</strong></p><p>Transfer code: <strong style="font-size:22px">${escapeEmailHtml(code)}</strong></p><p><a href="${escapeEmailHtml(link)}" style="display:inline-block;background:#d71920;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Accept transfer</a></p></div>`,
    });
    emailStatus = result.status;
    await admin.from("ownership_transfers").update({ email_status: result.status, email_provider_id: result.providerId, email_error: result.error }).eq("id", transfer.id);
  }
  return NextResponse.json({ code, expiresAt, emailStatus });
}
