import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const appUrl = getPublicAppUrl(request.nextUrl.origin);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@tooltrack.ie";
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const body = [
    `Contact: mailto:${supportEmail}`,
    `Contact: ${appUrl}/contact`,
    `Policy: ${appUrl}/terms`,
    `Canonical: ${appUrl}/.well-known/security.txt`,
    "Preferred-Languages: en",
    `Expires: ${expires.toISOString()}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
