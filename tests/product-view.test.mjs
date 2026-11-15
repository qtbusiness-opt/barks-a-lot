// Pure derivations behind the product page
// (src/app/products/[id]/_lib/product-view.js): gallery entries, their
// React keys, and what the customer's option picks mean for price, stock
// and the cart line.
import { test } from "node:test";
import assert from "node:assert/strict";

const { withOccurrenceKeys, buildGallery, slotFor, deriveSelectionState } =
  await import("../src/app/products/[id]/_lib/product-view.js");

test("repeated values still get unique keys", () => {
  const rows = [{ label: "Fat" }, { label: "Fat" }, { label: "Fiber" }];
  const keys = withOccurrenceKeys(rows, (r) => r.label).map((r) => r.key);
  assert.equal(new Set(keys).size, 3);
});

test("a value shaped like a counted key can't collide", () => {
  const keys = withOccurrenceKeys(
    [{ v: "x" }, { v: "x" }, { v: "1:x" }],
    (r) => r.v
  ).map((r) => r.key);
  assert.equal(new Set(keys).size, 3);
});

test("appending a choice photo keeps the product photos' keys", () => {
  const own = ["/a.jpg", "/b.jpg", "/a.jpg"];
  const before = buildGallery(own, null);
  const after = buildGallery(own, { src: "/plaid.jpg", label: "Style: Plaid" });
  assert.deepEqual(
    after.slice(0, 3).map((p) => p.key),
    before.map((p) => p.key)
  );
  assert.equal(after.length, 4);
  assert.equal(after[3].label, "Style: Plaid");
});

test("a choice photo already in the gallery isn't listed twice", () => {
  const own = ["/a.jpg", "/b.jpg"];
  const photos = buildGallery(own, { src: "/b.jpg", label: "Style: B" });
  assert.equal(photos.length, 2);
  assert.equal(slotFor(own, "/b.jpg"), 1);
  assert.equal(slotFor(own, "/new.jpg"), 2);
});

const tracked = {
  price: 10,
  available: true,
  trackOptionStock: true,
  optionGroups: [
    {
      id: "size",
      name: "Size",
      required: true,
      inputType: "select",
      setsPrice: true,
      choices: [
        { id: "s", label: "Small", price: 8 },
        { id: "l", label: "Large", price: 14 },
      ],
    },
    {
      id: "extras",
      name: "Extras",
      required: false,
      inputType: "checkbox",
      choices: [
        { id: "tag", label: "Name tag" },
        { id: "bell", label: "Bell" },
      ],
    },
  ],
  variants: [
    { id: "v-s", name: "Small", inStock: false, choices: [{ choiceId: "s" }] },
    { id: "v-l", name: "Large", inStock: true, choices: [{ choiceId: "l" }] },
  ],
};

test("before a size is picked: missing group, some combination in stock", () => {
  const s = deriveSelectionState(tracked, {});
  assert.equal(s.missingGroup.id, "size");
  assert.equal(s.combination, null);
  assert.equal(s.inStock, true);
  assert.equal(s.purchasable, false);
  assert.equal(s.price, 10);
  assert.deepEqual(s.chosenOptions, []);
});

test("a sold-out combination can't be bought; its price still shows", () => {
  const s = deriveSelectionState(tracked, { size: ["s"] });
  assert.equal(s.combination.id, "v-s");
  assert.equal(s.inStock, false);
  assert.equal(s.purchasable, false);
  assert.equal(s.price, 8);
});

test("an in-stock combination resolves price and cart labels", () => {
  const s = deriveSelectionState(tracked, {
    size: ["l"],
    extras: ["bell", "tag"],
  });
  assert.equal(s.combination.id, "v-l");
  assert.equal(s.purchasable, true);
  assert.equal(s.price, 14);
  assert.deepEqual(s.chosenOptions, [
    { groupId: "size", group: "Size", choiceIds: ["l"], values: ["Large"] },
    {
      groupId: "extras",
      group: "Extras",
      choiceIds: ["bell", "tag"],
      // In the group's own order, not the order they were ticked.
      values: ["Name tag", "Bell"],
    },
  ]);
});

test("without option stock, the product's own price and stock apply", () => {
  const s = deriveSelectionState(
    { ...tracked, trackOptionStock: false, inStock: false },
    { size: ["l"] }
  );
  assert.equal(s.combination, null);
  assert.equal(s.price, 10);
  assert.equal(s.inStock, false);
  assert.equal(s.purchasable, true);
});
