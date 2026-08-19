import { z } from "zod";

// Variants and option groups (in display order), the shape needed
// wherever a product's full storefront detail is read: admin forms, the
// product page, and order creation. One shared shape so those reads
// can't drift apart.
//
// Archived variants and choices — retired combinations/options that
// still anchor order history — are excluded here, not filtered later.
// That's a correctness boundary, not just tidiness: it's what stops a
// customer from ever re-selecting a retired combination, since
// validateSelections only ever sees what this include returns.
export const PRODUCT_DETAIL_INCLUDE = {
  variants: {
    where: { archivedAt: null },
    include: { choices: true },
  },
  optionGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      choices: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  },
};

// Availability rules for limited/seasonal drops. A product is purchasable
// only inside its availability window; sold-out limited drops disappear
// from listings entirely (regular products stay visible as "out of stock").

export function isWithinWindow(product, now = new Date()) {
  if (product.availableFrom && now < new Date(product.availableFrom))
    return false;
  if (product.availableUntil && now > new Date(product.availableUntil))
    return false;
  return true;
}

export function totalStock(product) {
  if (product.trackOptionStock) {
    return (product.variants ?? []).reduce((sum, v) => sum + v.quantity, 0);
  }
  if (product.variants?.length) {
    // Legacy hand-named variants (no linked choices) — stock still
    // lives per-variant even though trackOptionStock is off.
    return product.variants.reduce((sum, v) => sum + v.quantity, 0);
  }
  return product.quantity;
}

/**
 * The authoritative price for one cart line — resolved entirely
 * server-side, since a price sent by the client is never trusted.
 *
 *   - trackOptionStock product: the pricing group's chosen choice price,
 *     falling back to the product's base price (no pricing group, or
 *     the choice itself has none set).
 *   - legacy variant product: the chosen variant's price, falling back
 *     to the product's base price.
 *   - plain product: the product's base price.
 */
export function resolveLinePrice(product, { pricingChoice, variant } = {}) {
  if (product.trackOptionStock) {
    return pricingChoice?.price ?? product.price;
  }
  return variant?.price ?? product.price;
}

export function visibleInListing(product, now = new Date()) {
  if (!isWithinWindow(product, now)) return false;
  // Auto-hide sold-out limited drops — a one-off batch that's gone is gone.
  if (product.limitedQuantity != null && totalStock(product) <= 0) return false;
  return true;
}

// Gallery images are stored as a JSON-encoded string; every API
// response hands the client a real array instead.
export function parseImages(product) {
  try {
    const parsed = JSON.parse(product.images ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// One row of the nutrition table, e.g. { label: "Crude Protein (min)",
// value: "24%" }. Lives next to the parser below so validation and
// parsing can't drift apart. (This module is imported by API routes
// only, so zod never reaches the client bundle.)
export const nutritionRowSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
});

// Nutrition facts are stored the same way as gallery images: a
// JSON-encoded array of {label, value} rows. Anything malformed reads as
// "no nutrition facts" rather than breaking the product page.
export function parseNutrition(product) {
  try {
    const parsed = JSON.parse(product.nutritionFacts ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => ({
        label: String(row.label ?? ""),
        value: String(row.value ?? ""),
      }))
      .filter((row) => row.label !== "" || row.value !== "");
  } catch {
    return [];
  }
}

// Customer-facing product shape: exact stock counts are business data and
// stay on the admin API — the storefront gets booleans. inStock on the
// product row is already maintained by checkout/cancel/admin writes;
// variants get a derived flag here.
export function publicProduct(product) {
  const { quantity: _quantity, variants, ...rest } = product;
  return {
    ...rest,
    images: parseImages(product),
    nutritionFacts: parseNutrition(product),
    variants: (variants ?? []).map(({ quantity, ...v }) => ({
      ...v,
      inStock: quantity > 0,
    })),
  };
}

// Admin-facing product shape: the full row (stock counts included) with
// the JSON-encoded columns handed back as real arrays, so the admin
// forms can round-trip them without parsing at every call site.
export function adminProduct(product) {
  return {
    ...product,
    images: parseImages(product),
    nutritionFacts: parseNutrition(product),
  };
}
