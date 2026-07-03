import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tooltrack_beta_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

function safeReturnPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export async function POST(request: NextRequest) {
  const betaCode = process.env.BETA_ACCESS_CODE;

  if (!betaCode) {
    return NextResponse.json(
      { error: "Beta access is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const submittedCode =
    typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
      ? body.code
      : "";

  const returnTo =
    typeof body === "object" && body !== null && "returnTo" in body
      ? safeReturnPath(body.returnTo)
      : "/";

  const submittedHash = hashValue(submittedCode);
  const expectedHash = hashValue(betaCode);

  if (!safeCompare(submittedHash, expectedHash)) {
    return NextResponse.json(
      { error: "Incorrect access code." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json({ success: true, redirectTo: returnTo });

  response.cookies.set({
    name: COOKIE_NAME,
    value: expectedHash,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return response;
}
