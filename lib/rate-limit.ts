import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function requestIp(headers: Headers): string {
  return (headers.get("x-forwarded-for")?.split(",")[0] || headers.get("x-real-ip") || "unknown").trim();
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function checkRateLimit(key: string, maximum: number, windowMs: number): Promise<RateLimitResult> {
  const admin = getSupabaseAdmin();
  const fallbackResetAt = Date.now() + windowMs;

  if (!admin) {
    return { allowed: false, remaining: 0, resetAt: fallbackResetAt };
  }

  const { data, error } = await admin.rpc("tooltrack_check_rate_limit", {
    p_key: hashKey(key),
    p_max: maximum,
    p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
  });

  if (error || !data) {
    return { allowed: false, remaining: 0, resetAt: fallbackResetAt };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const resetAt = row?.reset_at ? new Date(row.reset_at).getTime() : fallbackResetAt;

  return {
    allowed: Boolean(row?.allowed),
    remaining: Math.max(0, Number(row?.remaining ?? 0)),
    resetAt,
  };
}
