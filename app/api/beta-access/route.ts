import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const COOKIE_NAME = "tooltrack_beta_access";
const DEFAULT_COOKIE_MAX_AGE_HOURS = 72;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 5;

function betaCookieMaxAgeSeconds(): number {
  const configured = Number(process.env.BETA_COOKIE_MAX_AGE_HOURS ?? DEFAULT_COOKIE_MAX_AGE_HOURS);
  const hours = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 168) : DEFAULT_COOKIE_MAX_AGE_HOURS;
  return Math.floor(hours * 60 * 60);
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function rateKey(request: NextRequest): string {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
  const ua = request.headers.get("user-agent") || "unknown";
  return hashValue(`${ip}|${ua}`);
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

async function checkSharedRateLimit(key: string) {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return { allowed: true, limited: false, error: "Supabase admin client is not configured; shared rate limit could not be checked." };
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("beta_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("rate_key", key)
    .eq("success", false)
    .gte("attempted_at", windowStart);

  if (error) {
    return { allowed: false, limited: true, error: error.message };
  }

  return { allowed: (count ?? 0) < RATE_LIMIT_MAX_FAILURES, limited: (count ?? 0) >= RATE_LIMIT_MAX_FAILURES, error: null };
}

async function recordAttempt(key: string, success: boolean) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  if (success) {
    await admin.from("beta_access_attempts").delete().eq("rate_key", key);
    return;
  }

  await admin.from("beta_access_attempts").insert({ rate_key: key, success });
}

export async function POST(request: NextRequest) {
  const betaCode = process.env.BETA_ACCESS_CODE;

  if (!betaCode) {
    return NextResponse.json(
      { error: "Beta access is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = rateKey(request);
  const rateLimit = await checkSharedRateLimit(key);

  if (!rateLimit.allowed) {
    console.warn("Beta access rate limit blocked", { limited: rateLimit.limited, error: rateLimit.error });
    return NextResponse.json(
      { error: "Too many incorrect access-code attempts. Please wait and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60) } },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    await recordAttempt(key, false);
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const submittedCode =
    typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
      ? body.code.trim()
      : "";

  const returnTo =
    typeof body === "object" && body !== null && "returnTo" in body
      ? safeReturnPath(body.returnTo)
      : "/";

  const submittedHash = hashValue(submittedCode);
  const expectedHash = hashValue(betaCode);

  if (!safeCompare(submittedHash, expectedHash)) {
    await recordAttempt(key, false);
    return NextResponse.json(
      { error: "Incorrect access code." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  await recordAttempt(key, true);

  const response = NextResponse.json({ success: true, redirectTo: returnTo });

  response.cookies.set({
    name: COOKIE_NAME,
    value: expectedHash,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: betaCookieMaxAgeSeconds(),
  });

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return response;
}
