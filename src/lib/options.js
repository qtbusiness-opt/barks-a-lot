// Product option groups: the choices a customer makes on the product page
// (a bandana's Size and Style, say). Unlike variants they carry no price
// or stock of their own — they're answers recorded on the order — so a
// product can have several without multiplying SKUs.

// How a group's choices are presented. Only "checkbox" takes more than
// one answer.
export const OPTION_INPUT_TYPES = ["select", "carousel", "radio", "checkbox"];

export const OPTION_INPUT_LABELS = {
  select: "Dropdown",
  carousel: "Image carousel",
  radio: "Radio buttons",
  checkbox: "Checkboxes",
};

export const allowsMultiple = (inputType) => inputType === "checkbox";

// Canonical key for a set of choice ids that defines one stock
// combination — order-independent, so {Size, Style} and {Style, Size}
// land on the same key. Shared by the admin write path
// (src/lib/option-writes.js, building combinations) and order creation
// (matching a customer's selection to one), so they can't drift apart.
export const combinationKey = (choiceIds) => [...choiceIds].sort().join("+");

// Selections travel as [{ group, values: [...] }] and are stored on the
// order item as a JSON snapshot of the labels, so renaming or deleting an
// option later can't rewrite what was actually ordered.
export function parseSelectedOptions(raw) {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => ({
        group: String(row.group ?? ""),
        values: Array.isArray(row.values) ? row.values.map(String) : [],
      }))
      .filter((row) => row.group !== "" && row.values.length > 0);
  } catch {
    return [];
  }
}

/**
 * The choice the customer just picked, when it carries a photo of its own
 * — what the product page swaps its main image over to, the way a
 * storefront swatch does.
 *
 * Compares the selections before and after a change rather than reading
 * the current state, so the pick that just happened wins even when
 * several groups have photos. Returns { choiceId, src, label } or null.
 *
 * `selections` on both sides is the page's { [groupId]: [choiceId, ...] }.
 */
export function pickedImageChoice(groups, before, after) {
  for (const group of groups ?? []) {
    const was = before?.[group.id] ?? [];
    const now = after?.[group.id] ?? [];
    const choice = (group.choices ?? []).find(
      (c) => c.image && now.includes(c.id) && !was.includes(c.id)
    );
    if (choice) {
      return {
        choiceId: choice.id,
        src: choice.image,
        label: `${group.name}: ${choice.label}`,
      };
    }
  }
  return null;
}

// Whether a choice is still picked in any group — how the product page
// knows a photo it swapped in belongs to a choice that has since been
// unticked.
export function isChoiceSelected(selections, choiceId) {
  return Object.values(selections ?? {}).some((ids) =>
    (ids ?? []).includes(choiceId)
  );
}

// "Size: Large · Style: Plaid" — one line for carts, orders and emails.
export function formatSelectedOptions(selections) {
  return (selections ?? [])
    .map((s) => `${s.group}: ${s.values.join(", ")}`)
    .join(" · ");
}

/**
 * Checks a customer's selections against the product's groups. Never
 * trusts the labels sent by the browser — they're matched against the
 * stored choices by id. On success returns:
 *
 *   - selections: [{group, values}] — labels only, unchanged shape, the
 *     exact snapshot stored on the order (renaming/deleting an option
 *     later can't rewrite what was actually ordered).
 *   - combinationChoiceIds: the chosen choice id from every REQUIRED,
 *     SINGLE-SELECT group (select/radio/carousel) — the same groups
 *     that make up a product's stock combinations (see
 *     src/lib/option-writes.js) — for matching against a
 *     ProductVariantChoice set. Empty when the product has no such
 *     groups.
 *   - pricingChoice: the chosen {id, price} from the group flagged
 *     setsPrice, or null if there isn't one or it wasn't required.
 *   - chosenImage: the picture belonging to a chosen choice — what the
 *     product page swapped its main image to — or null when nothing
 *     picked carries one. The order snapshots this so the line keeps
 *     showing the pattern that was bought.
 *
 *     Only single-select groups are considered: a checkbox group is a
 *     list of add-ons, and an add-on's picture shouldn't stand in for
 *     the thing itself. Groups are walked in sortOrder, so the first
 *     one carrying a picture wins and the result doesn't depend on the
 *     order the customer happened to click in. That can differ from the
 *     product page, which shows whichever photo was clicked last, but
 *     only for a product where two single-select groups both have
 *     pictures — and either photo is a true picture of what was bought.
 *
 * On failure: { ok: false, error } with a customer-safe message.
 */
export function validateSelections(product, submitted) {
  const groups = product.optionGroups ?? [];
  if (groups.length === 0) {
    return {
      ok: true,
      selections: [],
      combinationChoiceIds: [],
      pricingChoice: null,
      chosenImage: null,
    };
  }

  const byGroup = new Map(
    (submitted ?? []).map((s) => [String(s.groupId), s.choiceIds ?? []])
  );
  const selections = [];
  const combinationChoiceIds = [];
  let pricingChoice = null;
  let chosenImage = null;

  for (const group of groups) {
    const chosenIds = byGroup.get(group.id) ?? [];
    const valid = group.choices.filter((c) => chosenIds.includes(c.id));

    if (valid.length !== chosenIds.length) {
      return { ok: false, error: `Please re-check the ${group.name} options` };
    }
    if (valid.length === 0) {
      if (group.required) {
        return { ok: false, error: `Please choose a ${group.name}` };
      }
      continue;
    }
    if (valid.length > 1 && !allowsMultiple(group.inputType)) {
      return { ok: false, error: `Please choose one ${group.name}` };
    }

    selections.push({
      group: group.name,
      values: group.choices
        .filter((c) => chosenIds.includes(c.id))
        .map((c) => c.label),
    });

    if (group.required && !allowsMultiple(group.inputType)) {
      combinationChoiceIds.push(valid[0].id);
    }
    if (group.setsPrice) {
      pricingChoice = { id: valid[0].id, price: valid[0].price ?? null };
    }
    if (!chosenImage && !allowsMultiple(group.inputType) && valid[0].image) {
      chosenImage = valid[0].image;
    }
  }

  return {
    ok: true,
    selections,
    combinationChoiceIds,
    pricingChoice,
    chosenImage,
  };
}
