import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tooltrack_beta_access";

async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function addPrivateBetaHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublicTechnicalRoute =
    pathname === "/beta-access" ||
    pathname === "/api/beta-access" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)$/i.test(pathname);

  if (isPublicTechnicalRoute) {
    return addPrivateBetaHeaders(NextResponse.next());
  }

  const betaCode = process.env.BETA_ACCESS_CODE;

  if (!betaCode) {
    return new NextResponse(
      "ToolTrack beta access is not configured. Missing BETA_ACCESS_CODE.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const expectedCookie = await hashValue(betaCode);
  const suppliedCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (suppliedCookie !== expectedCookie) {
    const accessUrl = request.nextUrl.clone();
    accessUrl.pathname = "/beta-access";
    accessUrl.search = "";

    const returnTo = `${pathname}${search}`;
    if (returnTo !== "/") accessUrl.searchParams.set("returnTo", returnTo);

    return addPrivateBetaHeaders(NextResponse.redirect(accessUrl));
  }

  return addPrivateBetaHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
