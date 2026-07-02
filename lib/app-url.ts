/**
 * Resolve the public ToolTrack URL for links sent from server routes.
 * A configured custom domain wins. During Vercel beta testing, the current
 * request origin wins over a stale generated Vercel domain.
 */
export function getPublicAppUrl(requestOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "";
  const origin = requestOrigin?.trim().replace(/\/$/, "") || "";

  if (!configured) return origin || "http://localhost:3000";
  if (!origin) return configured;

  try {
    const configuredHost = new URL(configured).hostname;
    const originHost = new URL(origin).hostname;
    const configuredIsVercel = configuredHost.endsWith(".vercel.app");
    const originIsVercel = originHost.endsWith(".vercel.app");

    if (configuredIsVercel && originIsVercel && configuredHost !== originHost) {
      return origin;
    }
  } catch {
    return origin || configured;
  }

  return configured;
}
