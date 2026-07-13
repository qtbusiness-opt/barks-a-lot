// Outbound email. With RESEND_API_KEY configured, sends through Resend's
// HTTP API (no SDK needed at this scale). Without one — local dev — the
// email is logged to the server console so the flow stays testable.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "Barks-A-Lot <noreply@barks-a-lot.com>";

export const emailConfigured = Boolean(RESEND_API_KEY);

export async function sendEmail({ to, subject, text, html }) {
  if (!emailConfigured) {
    console.info(
      `[mail] (not configured — logging instead)\n  To: ${to}\n  Subject: ${subject}\n  ${text}`
    );
    return { delivered: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, html }),
  });

  if (!res.ok) {
    console.error(`[mail] send failed status=${res.status}`);
    throw new Error("Email delivery failed");
  }
  return { delivered: true };
}
