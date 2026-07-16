// Server-authoritative discount engine. Never trusts client-sent prices —
// callers pass line items with the price already resolved server-side.
//
// Two promotion kinds combine (bundle pricing first, then a percent-off
// code on the reduced subtotal):
//   - bundle: buy `bundleQuantity` of any products in `productIds` for
//     `bundlePrice` (mix-and-match). Extra sets stack; leftover units are
//     full price.
//   - code: `percentOff` off the whole (post-bundle) subtotal, activated
//     by entering `code` at checkout.

export const normalizeCode = (raw) =>
  String(raw ?? "").trim().toUpperCase();

function parseProductIds(promo) {
  try {
    const arr = JSON.parse(promo.productIds ?? "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Expand order lines into individual units tagged with their unit price,
// so bundle grouping can mix products freely.
function expandUnits(lines) {
  const units = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      units.push({ productId: line.productId, price: line.price });
    }
  }
  return units;
}

// Round to cents to avoid floating-point drift in stored totals.
const cents = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} args
 * @param {Array<{productId,price,quantity}>} args.lines server-priced cart lines
 * @param {Array} args.promotions all promotions (active + inactive)
 * @param {string} [args.code] promo code entered at checkout
 * @returns {{ subtotal, discountTotal, total, applied: string[], codeError: string|null }}
 */
export function computeDiscounts({ lines, promotions, code }) {
  const subtotal = cents(
    lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
  );
  const applied = [];
  let discount = 0;

  const activeBundles = promotions.filter(
    (p) => p.active && p.type === "bundle" && p.bundleQuantity && p.bundlePrice
  );

  // Apply bundles over a shared pool of units so overlapping promos can't
  // double-count the same item.
  let units = expandUnits(lines);
  for (const promo of activeBundles) {
    const ids = new Set(parseProductIds(promo));
    if (ids.size === 0) continue;

    const eligibleIdx = units
      .map((u, i) => (ids.has(u.productId) ? i : -1))
      .filter((i) => i >= 0)
      // Bundle the most expensive eligible units first — the customer
      // gets the biggest saving, which matches shopper expectations.
      .sort((a, b) => units[b].price - units[a].price);

    const setCount = Math.floor(eligibleIdx.length / promo.bundleQuantity);
    if (setCount === 0) continue;

    const consumed = eligibleIdx.slice(0, setCount * promo.bundleQuantity);
    const normalPrice = consumed.reduce((sum, i) => sum + units[i].price, 0);
    const bundledPrice = setCount * promo.bundlePrice;
    const saving = normalPrice - bundledPrice;

    if (saving > 0) {
      discount += saving;
      applied.push(
        `${promo.name} (${setCount} × any ${promo.bundleQuantity} for $${promo.bundlePrice.toFixed(2)})`
      );
      // Remove consumed units from the pool for later bundles.
      const drop = new Set(consumed);
      units = units.filter((_, i) => !drop.has(i));
    }
  }

  // Then a single percent-off code on the post-bundle subtotal.
  let codeError = null;
  const normalized = normalizeCode(code);
  if (normalized) {
    const promo = promotions.find(
      (p) => p.type === "code" && normalizeCode(p.code) === normalized
    );
    if (!promo || !promo.active) {
      codeError = "That promo code isn't valid.";
    } else {
      const base = subtotal - discount;
      const codeDiscount = cents((base * (promo.percentOff ?? 0)) / 100);
      discount += codeDiscount;
      applied.push(`${promo.name} (${promo.percentOff}% off)`);
    }
  }

  discount = Math.min(cents(discount), subtotal);
  return {
    subtotal,
    discountTotal: discount,
    total: cents(subtotal - discount),
    applied,
    codeError,
  };
}
