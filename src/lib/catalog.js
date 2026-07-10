// Availability rules for limited/seasonal drops. A product is purchasable
// only inside its availability window; sold-out limited drops disappear
// from listings entirely (regular products stay visible as "out of stock").

export function isWithinWindow(product, now = new Date()) {
  if (product.availableFrom && now < new Date(product.availableFrom)) return false;
  if (product.availableUntil && now > new Date(product.availableUntil)) return false;
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
