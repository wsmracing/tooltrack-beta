export type EmailSendResult = {
  status: "sent" | "skipped" | "failed";
  providerId: string | null;
  error: string | null;
  deliveredTo: string | null;
};

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function sendToolTrackEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "skipped", providerId: null, error: "RESEND_API_KEY is not configured.", deliveredTo: null };
  }

  const configuredFrom = process.env.RESEND_FROM_EMAIL?.trim();
  const from = configuredFrom || "ToolTrack <noreply@mail.tooltrack.ie>";
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
