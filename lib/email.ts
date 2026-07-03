export type EmailSendResult = {
  status: "sent" | "skipped" | "failed";
  providerId: string | null;
  error: string | null;
  deliveredTo: string | null;
};

export type ToolTrackEmailKind = "sighting" | "shop" | "support";

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character] ?? character);
}

function senderFor(kind: ToolTrackEmailKind) {
  const configured = {
    sighting: process.env.RESEND_SIGHTING_FROM_EMAIL,
    shop: process.env.RESEND_SHOP_FROM_EMAIL,
    support: process.env.RESEND_SUPPORT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL,
  }[kind]?.trim();

  if (configured) return configured;
  if (kind === "sighting") return "sighting@mail.tooltrack.ie";
  if (kind === "shop") return "shop@mail.tooltrack.ie";
  return "support@mail.tooltrack.ie";
}

export async function sendToolTrackEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
  kind = "support",
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey: string;
  kind?: ToolTrackEmailKind;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "skipped", providerId: null, error: "RESEND_API_KEY is not configured.", deliveredTo: null };
  }

  const from = senderFor(kind);
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "support@tooltrack.ie";
  const deliveredTo = to.trim().toLowerCase();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [deliveredTo],
      reply_to: replyTo,
      subject,
      html,
      text,
      tags: [
        { name: "application", value: "tooltrack" },
        { name: "message_type", value: kind },
        { name: "environment", value: process.env.VERCEL_ENV || "production" },
      ],
    }),
  });

  const raw = await response.text();
  let body: { id?: string; message?: string; error?: string } = {};
  try {
    body = raw ? JSON.parse(raw) as typeof body : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    const detail = body.message || body.error || raw || "Email provider rejected the message.";
    return { status: "failed", providerId: null, error: detail.slice(0, 500), deliveredTo };
  }

  return { status: "sent", providerId: body.id ?? null, error: null, deliveredTo };
}
