import { NextRequest, NextResponse } from "next/server";
import { escapeEmailHtml, sendToolTrackEmail } from "@/lib/email";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

function cleanText(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request.headers);
  if (!checkRateLimit(`signup-notify:${ip}`, 8, 60 * 60_000).allowed) {
    return NextResponse.json({ error: "Too many signup notifications." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as { email?: unknown; name?: unknown; userId?: unknown };
  const email = cleanText(body.email, 254).toLowerCase();
  const name = cleanText(body.name, 120);
  const userId = cleanText(body.userId, 80);

  if (!email || !email.includes("@")) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const adminEmail = (process.env.TOOLTRACK_ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || process.env.RESEND_REPLY_TO || "support@tooltrack.ie").trim();
  const createdAt = new Date().toLocaleString("en-IE", { timeZone: "Europe/Dublin" });

  const result = await sendToolTrackEmail({
    to: adminEmail,
    kind: "support",
    subject: "New ToolTrack sign-up",
    idempotencyKey: `signup-${userId || email}-${new Date().toISOString().slice(0, 10)}`,
    text: `New ToolTrack sign-up\nName: ${name || "Not supplied"}\nEmail: ${email}\nUser ID: ${userId || "Not supplied"}\nTime: ${createdAt}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1 style="color:#d71920">New ToolTrack sign-up</h1><p>A new account has been created.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Name</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeEmailHtml(name || "Not supplied")}</strong></td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Email</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeEmailHtml(email)}</strong></td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">User ID</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeEmailHtml(userId || "Not supplied")}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Time</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeEmailHtml(createdAt)}</td></tr></table></div>`,
  });

  return NextResponse.json({ status: result.status, providerId: result.providerId, error: result.error });
}
