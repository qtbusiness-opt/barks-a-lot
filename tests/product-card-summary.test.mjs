// What a product card shows before the product is opened
// (src/components/product-card-summary.js, rendered by ProductCard).
import { test } from "node:test";
import assert from "node:assert/strict";

const { summarizeCard } =
  await import("../src/components/product-card-summary.js");

test("a plain product quick-adds at its own price and stock", () => {
  assert.deepEqual(summarizeCard({ price: 6 }), {
    needsSelection: false,
    inStock: true,
    minPrice: 6,
    maxPrice: 6,
  });
  assert.equal(summarizeCard({ price: 6, inStock: false }).inStock, false);
});

test("variants set the price range, falling back to the base price", () => {
  const card = summarizeCard({
    price: 8,
    inStock: false,
    variants: [
      { price: 12, inStock: false },
      { price: null, inStock: true },
    ],
  });
  assert.equal(card.needsSelection, true);
  // In stock if any variant is, whatever the product-level flag says.
  assert.equal(card.inStock, true);
  assert.equal(card.minPrice, 8);
  assert.equal(card.maxPrice, 12);
});

test("an option group alone still routes to the product page", () => {
  // The bug this guards: a required group with no variants used to
  // quick-add with no options chosen and then fail at checkout.
  const card = summarizeCard({
    price: 15,
    optionGroups: [{ name: "Size", setsPrice: false, choices: [] }],
  });
  assert.equal(card.needsSelection, true);
  assert.equal(card.inStock, true);
  assert.equal(card.minPrice, 15);
  assert.equal(card.maxPrice, 15);
});

test("option-tracked stock prices from the group that sets the price", () => {
  const card = summarizeCard({
    price: 10,
    trackOptionStock: true,
    variants: [{ inStock: false }],
    optionGroups: [
      { setsPrice: false, choices: [{ price: 1 }] },
      {
        setsPrice: true,
        choices: [{ price: 18 }, { price: null }, { price: 14 }],
      },
    ],
  });
  assert.equal(card.needsSelection, true);
  assert.equal(card.inStock, false);
  assert.equal(card.minPrice, 14);
  assert.equal(card.maxPrice, 18);
});

test("option-tracked stock with no priced group shows the base price", () => {
  const card = summarizeCard({ price: 10, trackOptionStock: true });
  // No variants means nothing to sell yet.
  assert.equal(card.inStock, false);
  assert.equal(card.minPrice, 10);
  assert.equal(card.maxPrice, 10);
});
