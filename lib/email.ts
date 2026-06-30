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
  const from = configuredFrom || "ToolTrack <onboarding@resend.dev>";
  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim().toLowerCase() || "";
  const deliveredTo = testRecipient || to.trim().toLowerCase();
  const isRerouted = Boolean(testRecipient && testRecipient !== to.trim().toLowerCase());

  const rerouteNotice = isRerouted
    ? `<div style="padding:12px 14px;margin-bottom:18px;border:1px solid #e7b8ba;border-radius:8px;background:#fff4f4;color:#741319"><strong>Prototype email reroute</strong><br>This message was intended for ${escapeEmailHtml(to)}.</div>`
    : "";

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
      subject: isRerouted ? `[TEST] ${subject}` : subject,
      html: `${rerouteNotice}${html}`,
      text,
      tags: [
        { name: "application", value: "tooltrack" },
        { name: "environment", value: testRecipient ? "prototype" : "owner" },
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
