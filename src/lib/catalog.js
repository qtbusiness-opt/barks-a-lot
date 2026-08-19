import { z } from "zod";

// Variants and option groups (in display order), the shape needed
// wherever a product's full storefront detail is read: admin forms, the
// product page, and order creation. One shared shape so those reads
// can't drift apart.
export const PRODUCT_DETAIL_INCLUDE = {
  variants: true,
  optionGroups: {
    orderBy: { sortOrder: "asc" },
    include: { choices: { orderBy: { sortOrder: "asc" } } },
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
  if (product.variants?.length) {
    return product.variants.reduce((sum, v) => sum + v.quantity, 0);
  }
  return product.quantity;
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
