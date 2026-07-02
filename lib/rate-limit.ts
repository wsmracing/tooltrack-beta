type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function requestIp(headers: Headers): string {
  return (headers.get("x-forwarded-for")?.split(",")[0] || headers.get("x-real-ip") || "unknown").trim();
}

export function checkRateLimit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: Math.max(0, maximum - 1), resetAt: next.resetAt };
  }
  current.count += 1;
  if (buckets.size > 5000) {
    for (const [bucketKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(bucketKey);
  }
  return { allowed: current.count <= maximum, remaining: Math.max(0, maximum - current.count), resetAt: current.resetAt };
}
