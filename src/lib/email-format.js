// Building blocks for HTML email bodies. Deliberately a plain module
// with no imports: src/lib/mailer.js pulls in Prisma, so anything living
// there can't be loaded outside Next's bundler and can't be unit tested.
// The same reasoning that split src/lib/staging-gate.js out of the proxy
// — and it matters more here, because sendEmail short-circuits before
// sending whenever RESEND_API_KEY is unset, so nothing in dev or CI ever
// looks at the markup these produce. Tested directly in
// tests/email-format.test.mjs instead.

// Anything interpolated into email HTML goes through here first. Product
// names and option labels are admin-authored rather than public, but the
// quote escape is load-bearing: ProductOptionChoice.image is validated
// only as a bounded string (src/lib/option-writes.js), so without it a
// stored `x.png" onerror=` would break straight out of a src attribute
// and into the owner's mail client.
export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Raster formats a mail client will actually draw. SVG is deliberately
// absent — Gmail, Outlook and Apple Mail all strip it, and the seeded
// catalog art is entirely SVG, so treating it as displayable would fill
// order emails with broken-image boxes. WebP stays in: every modern
// client renders it, and only Outlook's desktop Word engine doesn't.
const MAIL_SAFE_IMAGE = /\.(png|jpe?g|webp|gif)$/i;

/**
 * An <img src> an inbox can actually load, or null to render text only.
 *
 * Two things have to hold. The source must be a raster (see above), and
 * we must be able to make it absolute — a "/images/…" path resolves
 * against nothing once the message has left the site.
 *
 * The base comes from APP_URL alone, never from the request. Falling
 * back to the request origin the way emailed links do would let a forged
 * Host header on a checkout POST choose which server draws pictures in
 * the owner's inbox — and unlike a link, an <img> is fetched the moment
 * the message is opened, with no click required. With APP_URL unset —
 * local dev, and any deployment that hasn't set it — order emails simply
 * stay text-only, exactly as they were.
 */
export function emailImageUrl(src, appUrl = process.env.APP_URL) {
  if (typeof src !== "string" || src === "") return null;
  if (!MAIL_SAFE_IMAGE.test(src.split("?")[0])) return null;
  if (/^https?:\/\//i.test(src)) return src;
  const base = (appUrl || "").replace(/\/+$/, "");
  if (!base) return null;
  return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
}

// Plain-text lines rendered as HTML paragraphs, so an email's two bodies
// can't drift apart.
export const emailParagraphs = (text) =>
  String(text ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p style="margin:4px 0">${escapeHtml(line)}</p>`)
    .join("");

export const orderItemName = (item) =>
  `${item.product.name}${item.variant ? ` (${item.variant.name})` : ""}`;

/**
 * The order's lines as an HTML table, each with the photo it was bought
 * as — the chosen option's picture when it had one. Falls back to the
 * product's current cover for orders placed before OrderItem.image
 * existed.
 *
 * The thumbnail column appears only when at least one line has a picture
 * an inbox can load: mixing lines with and without one would leave
 * ragged empty cells, and when none qualify the table collapses to the
 * same name/quantity/price the plain-text body already carries.
 */
export function orderItemsHtml(items, appUrl = process.env.APP_URL) {
  const rows = (items ?? []).map((item) => ({
    item,
    src: emailImageUrl(item.image ?? item.product.image, appUrl),
  }));
  const withImages = rows.some((r) => r.src);

  const cells = rows
    .map(({ item, src }) => {
      // Width and height as attributes, not just CSS: Outlook ignores
      // sizing declared in a style rule and would draw the photo at full
      // size. alt is empty because the name is in the very next cell —
      // with images blocked (the default in most clients) a real alt
      // would just say everything twice.
      const thumb = withImages
        ? `<td style="padding:6px 12px 6px 0;width:56px">${
            src
              ? `<img src="${escapeHtml(src)}" width="56" height="56" alt="" style="display:block;border-radius:8px" />`
              : ""
          }</td>`
        : "";
      const total = (item.price * item.quantity).toFixed(2);
      return (
        `<tr>${thumb}` +
        `<td style="padding:6px 0">${escapeHtml(orderItemName(item))}` +
        `<div style="color:#6b6b6b;font-size:13px">Qty ${escapeHtml(item.quantity)}</div></td>` +
        `<td style="padding:6px 0;text-align:right;white-space:nowrap">$${total}</td></tr>`
      );
    })
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${cells}</table>`;
}
