// Pure option helpers behind the product page's gallery: which pick, if
// any, should take over the main image (src/lib/options.js).
//
// The reason these compare before/after rather than reading the current
// selections: a bandana has both a Size group (no photos) and a Style
// carousel (photos). Deriving "the selected choice that has a photo"
// from state alone can't tell a fresh Style pick from a Size pick made
// while a Style was already chosen — and the second must leave the big
// image alone.
import { test } from "node:test";
import assert from "node:assert/strict";

const { pickedImageChoice, isChoiceSelected } =
  await import("../src/lib/options.js");

const SIZE = {
  id: "g-size",
  name: "Size",
  choices: [
    { id: "c-small", label: "Small", image: null },
    { id: "c-large", label: "Large", image: null },
  ],
};

const STYLE = {
  id: "g-style",
  name: "Style",
  choices: [
    { id: "c-plaid", label: "Plaid", image: "/images/plaid.png" },
    { id: "c-bones", label: "Bones", image: "/images/bones.png" },
  ],
};

const GROUPS = [SIZE, STYLE];

test("picking a carousel choice hands back its photo and a label", () => {
  const picked = pickedImageChoice(GROUPS, {}, { "g-style": ["c-plaid"] });
  assert.deepEqual(picked, {
    choiceId: "c-plaid",
    src: "/images/plaid.png",
    label: "Style: Plaid",
  });
});

test("switching to another thumbnail swaps to that one", () => {
  const picked = pickedImageChoice(
    GROUPS,
    { "g-style": ["c-plaid"] },
    { "g-style": ["c-bones"] }
  );
  assert.equal(picked?.choiceId, "c-bones");
  assert.equal(picked?.src, "/images/bones.png");
});

test("picking a choice with no photo leaves the main image alone", () => {
  assert.equal(
    pickedImageChoice(GROUPS, {}, { "g-size": ["c-small"] }),
    null,
    "a Size pick has nothing to show, so the gallery must not change"
  );
});

test("a pick in another group doesn't re-trigger the photo already showing", () => {
  // Style was chosen first, then Size. Only the Size group changed, so
  // nothing new should be swapped in — the Plaid photo is already up.
  assert.equal(
    pickedImageChoice(
      GROUPS,
      { "g-style": ["c-plaid"] },
      { "g-style": ["c-plaid"], "g-size": ["c-large"] }
    ),
    null
  );
});

test("unticking is not a pick", () => {
  assert.equal(
    pickedImageChoice(GROUPS, { "g-style": ["c-plaid"] }, { "g-style": [] }),
    null
  );
});

test("a multi-select add is a pick", () => {
  // Checkbox groups can hold several answers; adding one to an existing
  // selection still counts as choosing it.
  const addOns = {
    id: "g-addons",
    name: "Add-ons",
    choices: [
      { id: "c-bow", label: "Bow", image: "/images/bow.png" },
      { id: "c-tag", label: "Name tag", image: "/images/tag.png" },
    ],
  };
  const picked = pickedImageChoice(
    [addOns],
    { "g-addons": ["c-bow"] },
    { "g-addons": ["c-bow", "c-tag"] }
  );
  assert.equal(picked?.choiceId, "c-tag");
});

test("empty and missing inputs are handled, not thrown on", () => {
  assert.equal(pickedImageChoice(undefined, undefined, undefined), null);
  assert.equal(pickedImageChoice([], {}, {}), null);
  assert.equal(pickedImageChoice([{ id: "g", name: "G" }], {}, {}), null);
});

test("isChoiceSelected looks across every group", () => {
  const selections = { "g-size": ["c-small"], "g-style": ["c-plaid"] };
  assert.equal(isChoiceSelected(selections, "c-plaid"), true);
  assert.equal(isChoiceSelected(selections, "c-small"), true);
  assert.equal(isChoiceSelected(selections, "c-bones"), false);
  assert.equal(isChoiceSelected({}, "c-plaid"), false);
  assert.equal(isChoiceSelected(undefined, "c-plaid"), false);
});

// ── The server's half of the same idea ──────────────────────────────
// validateSelections resolves the photo the order gets frozen with. It
// only sees the final selections, never the click order, so its rule
// has to be positional rather than "whatever was picked last".

const { validateSelections } = await import("../src/lib/options.js");

const required = (group, over = {}) => ({
  inputType: "carousel",
  required: true,
  setsPrice: false,
  ...group,
  ...over,
});

const product = (groups) => ({ optionGroups: groups, price: 1 });

const answer = (group, choiceId) => ({
  groupId: group.id,
  choiceIds: [choiceId],
});

test("validateSelections returns the chosen choice's photo", () => {
  const groups = [required(SIZE, { inputType: "select" }), required(STYLE)];
  const res = validateSelections(product(groups), [
    answer(SIZE, "c-small"),
    answer(STYLE, "c-bones"),
  ]);
  assert.equal(res.ok, true);
  assert.equal(res.chosenImage, "/images/bones.png");
});

test("a chosen option with no photo of its own resolves to none", () => {
  const groups = [required(SIZE, { inputType: "select" })];
  const res = validateSelections(product(groups), [answer(SIZE, "c-large")]);
  assert.equal(res.ok, true);
  assert.equal(res.chosenImage, null);
});

test("a product with no option groups resolves to none", () => {
  const res = validateSelections(product([]), undefined);
  assert.equal(res.ok, true);
  assert.equal(res.chosenImage, null);
});

test("a checkbox add-on's photo never stands in for the product", () => {
  // Add-ons are extras bought alongside the thing, so a gift-wrap
  // thumbnail must not become the picture of the order line.
  const ADDONS = {
    id: "g-addons",
    name: "Add-ons",
    choices: [{ id: "c-wrap", label: "Gift wrap", image: "/images/wrap.png" }],
  };
  const groups = [
    required(ADDONS, { inputType: "checkbox", required: false }),
    required(SIZE, { inputType: "select" }),
  ];
  const res = validateSelections(product(groups), [
    answer(ADDONS, "c-wrap"),
    answer(SIZE, "c-small"),
  ]);
  assert.equal(res.ok, true);
  assert.equal(res.chosenImage, null);
});

test("with two picture-carrying groups the earlier one wins, whatever the answer order", () => {
  // The page shows whichever was clicked last; the server can't see
  // that, so it has to be deterministic instead. Both orderings of the
  // same answers must agree.
  const SECOND = {
    id: "g-trim",
    name: "Trim",
    choices: [{ id: "c-gold", label: "Gold", image: "/images/gold.png" }],
  };
  const groups = [required(STYLE), required(SECOND)];
  const forwards = validateSelections(product(groups), [
    answer(STYLE, "c-plaid"),
    answer(SECOND, "c-gold"),
  ]);
  const backwards = validateSelections(product(groups), [
    answer(SECOND, "c-gold"),
    answer(STYLE, "c-plaid"),
  ]);
  assert.equal(forwards.chosenImage, "/images/plaid.png");
  assert.equal(backwards.chosenImage, forwards.chosenImage);
});
