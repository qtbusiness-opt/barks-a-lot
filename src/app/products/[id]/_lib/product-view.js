// Pure derivations behind the product page: what the gallery shows and
// what the customer's option picks mean for price, stock and the cart
// line. Kept free of React (and of the "@/" alias) so node --test can
// exercise them directly (tests/product-view.test.mjs).
import { allowsMultiple, combinationKey } from "../../../../lib/options.js";

// React keys for a list whose entries can legitimately repeat — the
// admin can list the same photo twice, or two nutrition rows can share a
// label. Each entry is keyed by its own value plus how many times that
// value has already appeared, so keys stay unique and an entry keeps its
// key when something is added to or removed from the end of the list
// (the appended choice photo). The count leads and contains no ":", so
// no two (count, value) pairs can produce the same key.
export function withOccurrenceKeys(items, valueOf) {
  const seen = new Map();
  return items.map((item) => {
    const value = valueOf(item);
    const n = seen.get(value) ?? 0;
    seen.set(value, n + 1);
    return { ...item, key: `${n}:${value}` };
  });
}

// The product's own photos: its cover, then its gallery extras.
export function productPhotosOf(product) {
  return [product.image, ...(product.images ?? [])];
}

// Where a choice's photo sits in the gallery: its existing place when the
// product already shows it, otherwise the one slot appended after the
// product's own photos.
export function slotFor(productPhotos, src) {
  const existing = productPhotos.indexOf(src);
  return existing === -1 ? productPhotos.length : existing;
}

// The gallery: the product's own photos, plus the picked choice's
// thumbnail as one extra entry. A choice photo that's already in the
// gallery is shown in its existing place rather than listed twice.
// Entries are { src, label, key }, where a label marks a choice's photo
// ("Style: Plaid") and null marks one of the product's own.
export function buildGallery(productPhotos, optionImage) {
  const photos = [
    ...productPhotos.map((src) => ({ src, label: null })),
    ...(optionImage &&
    slotFor(productPhotos, optionImage.src) === productPhotos.length
      ? [{ src: optionImage.src, label: optionImage.label }]
      : []),
  ];
  return withOccurrenceKeys(photos, (photo) => photo.src);
}

const picksFor = (optionChoices, group) => optionChoices[group.id] ?? [];

// Everything the page shows that follows from the customer's picks.
// The order API re-checks all of this; answering here just saves the
// customer a round trip.
export function deriveSelectionState(product, optionChoices) {
  const optionGroups = product.optionGroups ?? [];

  const missingGroup = optionGroups.find(
    (g) => g.required && !picksFor(optionChoices, g).length
  );

  // The groups that define a stock combination — the same rule the
  // server uses (src/lib/options.js, src/lib/option-writes.js): required
  // and single-select. Once every one of these is answered, `combination`
  // resolves to the matching row in product.variants.
  const matrixGroups = optionGroups.filter(
    (g) => g.required && !allowsMultiple(g.inputType)
  );
  const matrixAnswered = matrixGroups.every(
    (g) => picksFor(optionChoices, g).length > 0
  );
  let combination = null;
  if (product.trackOptionStock && matrixAnswered) {
    const wanted = combinationKey(
      matrixGroups.map((g) => optionChoices[g.id][0])
    );
    combination =
      product.variants.find(
        (v) => combinationKey(v.choices.map((c) => c.choiceId)) === wanted
      ) ?? null;
  }

  const pricingGroup = optionGroups.find((g) => g.setsPrice) ?? null;
  const pricingChoiceId = pricingGroup
    ? picksFor(optionChoices, pricingGroup)[0]
    : null;
  const pricingChoice =
    pricingGroup && pricingChoiceId
      ? pricingGroup.choices.find((c) => c.id === pricingChoiceId)
      : null;
  const price = product.trackOptionStock
    ? (pricingChoice?.price ?? product.price)
    : product.price;

  // Availability is boolean-only on the storefront; exact counts live on
  // the admin side. Before every matrix group is answered, "in stock"
  // means "some combination is" — the same way it read before a variant
  // was chosen under the old picker.
  let inStock = product.inStock;
  if (product.trackOptionStock) {
    inStock = combination
      ? combination.inStock
      : product.variants.some((v) => v.inStock);
  }
  const purchasable =
    product.available &&
    !missingGroup &&
    (!product.trackOptionStock ||
      (combination !== null && combination.inStock));

  // Labels for the cart line, resolved from the ids the customer picked.
  const chosenOptions = optionGroups
    .map((g) => {
      const choiceIds = picksFor(optionChoices, g);
      const picked = new Set(choiceIds);
      return {
        groupId: g.id,
        group: g.name,
        choiceIds,
        values: g.choices.filter((c) => picked.has(c.id)).map((c) => c.label),
      };
    })
    .filter((o) => o.choiceIds.length > 0);

  return {
    optionGroups,
    missingGroup,
    combination,
    price,
    inStock,
    purchasable,
    chosenOptions,
  };
}
