// The HTML half of order email bodies (src/lib/email-format.js).
//
// These exist because nothing else exercises this markup: sendEmail
// short-circuits before sending whenever RESEND_API_KEY is unset, which
// is the case in dev and in CI, so the api tests place real orders and
// never look at what the HTML came out as. Without these, the emails
// would ship having never been rendered.
import { test } from "node:test";
import assert from "node:assert/strict";

const { escapeHtml, emailImageUrl, emailParagraphs, orderItemsHtml } =
  await import("../src/lib/email-format.js");

const APP = "https://barks-a-lot.example";

const line = (over = {}) => ({
  product: { name: "Bandana Set", image: "/images/products/cover.png" },
  variant: null,
  quantity: 2,
  price: 12.99,
  image: null,
  ...over,
});

test("emailImageUrl makes a site-relative path absolute", () => {
  assert.equal(
    emailImageUrl("/api/uploads/abc123.png", APP),
    `${APP}/api/uploads/abc123.png`
  );
});

test("emailImageUrl refuses SVG — mail clients strip it", () => {
  // The entire seeded catalog is SVG, so this is the common case in dev,
  // not an edge case. A broken-image box is worse than no image.
  assert.equal(emailImageUrl("/images/products/bandana-set.svg", APP), null);
});

test("emailImageUrl accepts the formats admins can actually upload", () => {
  for (const ext of ["png", "jpg", "jpeg", "webp", "gif", "PNG"]) {
    assert.ok(
      emailImageUrl(`/api/uploads/abc123.${ext}`, APP),
      `${ext} should be mailable`
    );
  }
});

test("emailImageUrl gives up when APP_URL is unset", () => {
  // A relative src in an inbox resolves against nothing. Emitting one
  // would be a guaranteed broken image, so the row goes text-only.
  assert.equal(emailImageUrl("/api/uploads/abc123.png", ""), null);
  assert.equal(emailImageUrl("/api/uploads/abc123.png", undefined), null);
});

test("emailImageUrl passes an already-absolute URL through", () => {
  assert.equal(
    emailImageUrl("https://cdn.example/x.png", APP),
    "https://cdn.example/x.png"
  );
});

test("emailImageUrl does not double the slash on a trailing-slash APP_URL", () => {
  assert.equal(
    emailImageUrl("/x.png", "https://barks-a-lot.example/"),
    "https://barks-a-lot.example/x.png"
  );
});

test("emailImageUrl handles junk without throwing", () => {
  for (const junk of [null, undefined, "", 42, {}, "/no-extension"]) {
    assert.equal(emailImageUrl(junk, APP), null);
  }
});

test("emailImageUrl cannot be talked into a protocol-relative host", () => {
  // "//evil.example/x.png" is a URL pointing at another host, but it is
  // not http(s)-prefixed, so it gets treated as a path and stays on ours.
  const url = emailImageUrl("//evil.example/x.png", APP);
  assert.ok(url.startsWith(`${APP}/`), url);
});

test("escapeHtml closes the src attribute breakout", () => {
  // ProductOptionChoice.image is validated only as a bounded string, so
  // this is reachable by an admin typing into the options editor.
  const out = escapeHtml('x.png" onerror="alert(1)');
  assert.ok(!out.includes('"'), out);
  assert.ok(out.includes("&quot;"), out);
});

test("orderItemsHtml uses the snapshot over the product's current cover", () => {
  const html = orderItemsHtml(
    [line({ image: "/api/uploads/picked.png" })],
    APP
  );
  assert.ok(html.includes(`${APP}/api/uploads/picked.png`), html);
  assert.ok(!html.includes("cover.png"), html);
});

test("orderItemsHtml falls back to the cover for pre-snapshot orders", () => {
  // OrderItem.image is null for every order placed before the column
  // existed; those must still show something.
  const html = orderItemsHtml([line({ image: null })], APP);
  assert.ok(html.includes(`${APP}/images/products/cover.png`), html);
});

test("orderItemsHtml drops the thumbnail column when nothing is mailable", () => {
  const html = orderItemsHtml(
    [line({ product: { name: "Chews", image: "/images/products/a.svg" } })],
    APP
  );
  assert.ok(!html.includes("<img"), html);
  // The line itself still has to be there — the table degrades, it does
  // not disappear.
  assert.ok(html.includes("Chews"), html);
  assert.ok(html.includes("$25.98"), html);
});

test("orderItemsHtml keeps a placeholder cell for a line with no photo", () => {
  // Ragged rows: one line mailable, one not. The column exists, so the
  // second line needs an empty cell or the name slides under the photo.
  const html = orderItemsHtml(
    [
      line({ image: "/api/uploads/picked.png" }),
      line({ product: { name: "Chews", image: "/images/products/a.svg" } }),
    ],
    APP
  );
  assert.equal(html.match(/<img/g).length, 1);
  assert.equal(html.match(/<tr>/g).length, 2);
  assert.equal(html.match(/width:56px/g).length, 2);
});

test("orderItemsHtml escapes the product and variant names", () => {
  const html = orderItemsHtml(
    [
      line({
        product: { name: 'Bandana <script>"', image: null },
        variant: { name: "Large & Floral" },
      }),
    ],
    APP
  );
  assert.ok(!html.includes("<script>"), html);
  assert.ok(html.includes("&lt;script&gt;"), html);
  assert.ok(html.includes("Large &amp; Floral"), html);
});

test("orderItemsHtml prices the line, not the unit", () => {
  const html = orderItemsHtml([line({ quantity: 3, price: 5 })], APP);
  assert.ok(html.includes("$15.00"), html);
  assert.ok(html.includes("Qty 3"), html);
});

test("orderItemsHtml survives an empty order", () => {
  assert.ok(orderItemsHtml([], APP).includes("<table"));
  assert.ok(orderItemsHtml(undefined, APP).includes("<table"));
});

test("emailParagraphs escapes and skips blank lines", () => {
  const html = emailParagraphs("Total: $5\n\nShipping to 1 A & B St");
  assert.equal(html.match(/<p /g).length, 2);
  assert.ok(html.includes("A &amp; B"), html);
});
