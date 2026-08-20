// Outbound email. With RESEND_API_KEY configured, sends through Resend's
// HTTP API (no SDK needed at this scale). Without one — local dev — the
// email is logged to the server console so the flow stays testable.
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/email-format";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "Barks-A-Lot <noreply@barks-a-lot.com>";

export const emailConfigured = Boolean(RESEND_API_KEY);

// The logo travels inside every branded email as an inline (CID)
// attachment, so it renders even before the site is publicly reachable
// and regardless of APP_URL — no external image fetch, no broken image.
const LOGO_CID = "barks-logo";
let logoBase64Cache;
function logoBase64() {
  if (logoBase64Cache === undefined) {
    try {
      const file = path.join(process.cwd(), "public/images/email-logo.png");
      logoBase64Cache = readFileSync(file).toString("base64");
    } catch (err) {
      console.error("[mail] logo asset missing:", err);
      logoBase64Cache = null;
    }
  }
  return logoBase64Cache;
}

// Wraps arbitrary inner HTML in a branded shell: the logo sits at the top
// as the visual header of every customer email. It references the inline
// CID attachment added by sendEmail.
export function brandedShell(innerHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2A4A52">
  <div style="text-align:center;margin-bottom:20px">
    <img src="cid:${LOGO_CID}" width="72" height="72" alt="Barks-A-Lot Treats & More"
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
  return brandedShell(escapeHtml(text).replace(/\n/g, "<br>"));
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

  const body = { from: EMAIL_FROM, to, subject, text, html: finalHtml };

  // Attach the logo inline whenever the HTML references it.
  if (finalHtml?.includes(`cid:${LOGO_CID}`)) {
    const content = logoBase64();
    if (content) {
      body.attachments = [
        {
          filename: "barks-a-lot-logo.png",
          content,
          content_id: LOGO_CID,
          content_type: "image/png",
          disposition: "inline",
        },
      ];
    }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Resend states the actual reason in the body — an unverified domain,
    // a from-address that isn't yours, or the sandbox rule that only lets
    // you mail your own account. Dropping it left every delivery problem
    // looking identical from the outside: silence.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`[mail] send failed status=${res.status} ${detail}`);
    throw new Error(
      `Email delivery failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
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
