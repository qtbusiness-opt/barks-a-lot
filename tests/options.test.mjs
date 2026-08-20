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
