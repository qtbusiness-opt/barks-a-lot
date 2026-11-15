// What a product card shows before anyone opens the product: whether it
// can be quick-added, whether it's in stock, and the price (or price
// range). Kept import-free so it can be unit tested
// (tests/product-card-summary.test.mjs); ProductCard renders from it.

// The public API exposes availability as booleans only — exact stock
// counts are admin-side business data.
function cardInStock({ inStock, variants, trackOptionStock }) {
  if (trackOptionStock || variants.length > 0) {
    return variants.some((v) => v.inStock);
  }
  return inStock;
}

function cardPrices({ price, variants, optionGroups, trackOptionStock }) {
  if (trackOptionStock) {
    return (optionGroups.find((g) => g.setsPrice)?.choices ?? [])
      .map((c) => c.price)
      .filter((p) => p != null);
  }
  if (variants.length > 0) return variants.map((v) => v.price ?? price);
  return [price];
}

export function summarizeCard({
  price,
  inStock = true,
  variants = [],
  optionGroups = [],
  trackOptionStock = false,
}) {
  const product = { price, inStock, variants, optionGroups, trackOptionStock };
  const prices = cardPrices(product);
  return {
    // Anything the customer must choose before a price or an "add to
    // cart" makes sense routes to the detail page instead of quick-adding.
    // Checking variants alone used to miss option groups entirely — a
    // product with a required group but no variants would quick-add with
    // no options at all, then fail at checkout with nothing on the cart
    // page able to fix it.
    needsSelection:
      variants.length > 0 || optionGroups.length > 0 || trackOptionStock,
    inStock: cardInStock(product),
    minPrice: prices.length > 0 ? Math.min(...prices) : price,
    maxPrice: prices.length > 0 ? Math.max(...prices) : price,
  };
}
