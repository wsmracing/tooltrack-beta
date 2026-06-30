import { NextRequest, NextResponse } from "next/server";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in again before sending a test email." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase server settings are not configured." }, { status: 503 });

  const { data, error } = await admin.auth.getUser(token);
  const user = data.user;
  if (error || !user?.email) return NextResponse.json({ error: "Your signed-in email address could not be verified." }, { status: 401 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const result = await sendToolTrackEmail({
    to: user.email,
    subject: "ToolTrack email test",
    idempotencyKey: `email-test-${user.id}-${Math.floor(Date.now() / 60000)}`,
    text: "Your ToolTrack email notifications are connected and ready for prototype testing.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171717">
        <div style="border-top:6px solid #d71920;padding-top:20px">
          <h1 style="font-size:24px">ToolTrack email is connected</h1>
          <p>This test was requested from the account for <strong>${escapeEmailHtml(user.email)}</strong>.</p>
          <p>Sighting alerts can now be sent when someone reports information about one of your stolen assets.</p>
          ${appUrl ? `<p style="margin-top:24px"><a href="${escapeEmailHtml(`${appUrl}/account`)}" style="display:inline-block;background:#d71920;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open account settings</a></p>` : ""}
        </div>
      </div>`,
  });

  if (result.status !== "sent") {
    return NextResponse.json({ error: result.error || "Email could not be sent." }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    message: result.deliveredTo === user.email.toLowerCase()
      ? `Test email sent to ${user.email}.`
      : `Prototype test email sent to ${result.deliveredTo}.`,
  });
}
