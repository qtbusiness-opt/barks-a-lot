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

// Customer-facing product shape: exact stock counts are business data and
// stay on the admin API — the storefront gets booleans. inStock on the
// product row is already maintained by checkout/cancel/admin writes;
// variants get a derived flag here.
export function publicProduct(product) {
  const { quantity: _quantity, variants, ...rest } = product;
  return {
    ...rest,
    images: parseImages(product),
    variants: (variants ?? []).map(({ quantity, ...v }) => ({
      ...v,
      inStock: quantity > 0,
    })),
  };
}
