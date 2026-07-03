const CANONICAL_APP_URL = "https://tooltrack.ie";

/**
 * Resolve the public ToolTrack URL for links sent from server routes.
 * The configured custom domain wins. During local development, the request
 * origin is retained when no public URL has been configured.
 */
export function getPublicAppUrl(requestOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "";
  const origin = requestOrigin?.trim().replace(/\/$/, "") || "";

  if (!configured) return origin || CANONICAL_APP_URL;
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
    return configured || origin || CANONICAL_APP_URL;
  }

  return configured;
}
