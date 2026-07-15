// Outbound email. With RESEND_API_KEY configured, sends through Resend's
// HTTP API (no SDK needed at this scale). Without one — local dev — the
// email is logged to the server console so the flow stays testable.
import { prisma } from "@/lib/prisma";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "Barks-A-Lot <noreply@barks-a-lot.com>";

export const emailConfigured = Boolean(RESEND_API_KEY);

// Absolute URL of the logo for use in HTML emails — email clients can't
// resolve relative paths. APP_URL should be the public site origin in
// production; falls back to the live domain.
const APP_URL = process.env.APP_URL || "https://barks-a-lot.com";
const LOGO_URL = `${APP_URL.replace(/\/$/, "")}/images/Barks-A-Lot%20Logo.png`;

// Wraps arbitrary inner HTML in a branded shell: the logo sits at the top
// as the visual "avatar" of every customer email.
export function brandedShell(innerHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2A4A52">
  <div style="text-align:center;margin-bottom:20px">
    <img src="${LOGO_URL}" width="72" height="72" alt="Barks-A-Lot Treats & More"
      style="border-radius:9999px;display:inline-block" />
    <div style="font-size:18px;font-weight:bold;margin-top:8px;color:#4A7C8A">Barks-A-Lot Treats &amp; More</div>
  </div>
  <div style="background:#ffffff;border-radius:12px;padding:20px;font-size:15px;line-height:1.6">${innerHtml}</div>
  <p style="text-align:center;color:#8a8a8a;font-size:12px;margin-top:20px">
    Barks-A-Lot Treats &amp; More · Handmade organic dog treats &amp; bandanas
  </p>
</div>`;
}

// Escapes plain text (preserving newlines) and drops it into the shell —
// used by emails that only have a text body.
export function brandedHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return brandedShell(escaped);
}

export async function sendEmail({ to, subject, text, html, branded = false }) {
  // Customer emails default to the branded HTML shell (logo header);
  // callers can pass their own html or opt out.
  const finalHtml = html ?? (branded ? brandedHtml(text) : undefined);

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
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, html: finalHtml }),
  });

  if (!res.ok) {
    console.error(`[mail] send failed status=${res.status}`);
    throw new Error("Email delivery failed");
  }
  return { delivered: true };
}

// Every admin's email — recipients for order alerts and contact messages.
export async function adminEmails() {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}
