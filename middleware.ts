import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tooltrack_beta_access";

async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const publicPaths = [
    "/beta-access",
    "/api/beta-access",
    "/favicon.ico",
    "/robots.txt",
    "/manifest.json",
    "/sw.js",
  ];

  const isPublicPath =
    publicPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/.well-known/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)$/i.test(
      pathname,
    );

  if (isPublicPath) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
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
        },
      },
    );
  }

  const expectedCookie = await hashValue(betaCode);
  const suppliedCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (suppliedCookie !== expectedCookie) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/beta-access";
    loginUrl.search = "";

    const returnTo = `${pathname}${search}`;

    if (returnTo !== "/") {
      loginUrl.searchParams.set("returnTo", returnTo);
    }

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
