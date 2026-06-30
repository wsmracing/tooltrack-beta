import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server configuration is incomplete." }, { status: 500 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });

  const body = await request.json() as { organizationId?: string; email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = ["admin", "editor", "viewer"].includes(body.role ?? "") ? body.role! : "viewer";
  if (!body.organizationId || !email) return NextResponse.json({ error: "Organisation and email are required." }, { status: 400 });

  const { data: membership } = await admin.from("organization_members").select("role, organizations(name)").eq("organization_id", body.organizationId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Only an owner or admin can invite team members." }, { status: 403 });

  const invitationToken = randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error: inviteError } = await admin.from("team_invitations").insert({ organization_id: body.organizationId, invited_by: auth.user.id, email, role, token: invitationToken, status: "pending", expires_at: expiresAt }).select("id").single();
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  const organizationName = ((membership.organizations as unknown as { name?: string } | null)?.name || "a ToolTrack team");
  const link = `${appUrl}/team/accept?token=${encodeURIComponent(invitationToken)}`;
  const result = await sendToolTrackEmail({
    to: email,
    subject: `You have been invited to ${organizationName} on ToolTrack`,
    idempotencyKey: `team-invite-${invitation.id}`,
    text: `You have been invited as ${role}. Accept the invitation: ${link}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1 style="color:#d71920">ToolTrack invitation</h1><p>You have been invited to join <strong>${escapeEmailHtml(organizationName)}</strong> as <strong>${escapeEmailHtml(role)}</strong>.</p><p><a href="${escapeEmailHtml(link)}" style="display:inline-block;background:#d71920;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Accept invitation</a></p><p>This link expires in 7 days.</p></div>`,
  });
  await admin.from("team_invitations").update({ email_status: result.status, email_provider_id: result.providerId, email_error: result.error }).eq("id", invitation.id);
  return NextResponse.json({ message: result.status === "sent" ? "Invitation saved and email sent." : "Invitation saved. Email delivery is not configured.", token: invitationToken, emailStatus: result.status });
}
