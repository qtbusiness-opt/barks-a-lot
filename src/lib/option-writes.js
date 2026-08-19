// Admin-side writing of product option groups. Kept out of options.js so
// the storefront helpers stay free of zod and Prisma.
import { z } from "zod";
import {
  OPTION_INPUT_TYPES,
  allowsMultiple,
  combinationKey,
} from "@/lib/options";

// A careless admin crossing two groups with 20 choices each would
// otherwise generate hundreds of stock rows in one save.
export const MAX_COMBINATIONS = 100;

const optionChoiceSchema = z.object({
  // Present when editing an existing choice; absent for a new one. IDs
  // are how the write path below tells "rename" from "replace" — losing
  // one on a choice that anchors stock would orphan that stock at zero.
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(80),
  // Thumbnail for carousel groups; ignored by the other types.
  image: z.string().trim().max(300).nullish(),
  // Meaningful only on the group flagged setsPrice.
  price: z.number().positive().max(10000).nullish(),
});

const optionGroupSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60),
  inputType: z.enum(OPTION_INPUT_TYPES),
  required: z.boolean().default(true),
  setsPrice: z.boolean().default(false),
  choices: z.array(optionChoiceSchema).min(1).max(20),
});

// One shared, validated shape for the admin product routes' `optionGroups`
// field — `.optional()`/`.default([])` chain onto it the same as any other
// zod schema.
export const optionGroupsSchema = z
  .array(optionGroupSchema)
  .max(6)
  .superRefine((groups, ctx) => {
    const pricingGroups = groups.filter((g) => g.setsPrice);
    if (pricingGroups.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one option group can set the price",
      });
    }
    // A multi-select group can't set a single price — the customer could
    // pick more than one choice at once.
    if (pricingGroups.some((g) => allowsMultiple(g.inputType))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The pricing group can't be a checkbox group",
      });
    }
    if (pricingGroups.some((g) => !g.required)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The pricing group must be required",
      });
    }
  });

function businessError(status, message) {
  return Object.assign(new Error(message), { code: status });
}

// Cartesian product of choice arrays, one per participating group —
// [[SizeChoices...], [StyleChoices...]] -> one array of choice tuples.
function cartesian(groupsOfChoices) {
  return groupsOfChoices.reduce(
    (cells, choices) =>
      cells.flatMap((cell) => choices.map((c) => [...cell, c])),
    [[]]
  );
}

/**
 * Replaces a product's option groups and, when trackOptionStock is on,
 * regenerates its stock combinations to match — id-stably, never
 * delete-and-recreate. Groups/choices with an id are updated in place;
 * without one they're created; ones no longer sent are removed if
 * nothing depends on them, archived otherwise. Must run inside a
 * transaction (`tx`).
 *
 * Combinations are the cartesian product of every REQUIRED, SINGLE-SELECT
 * group's choices (select/radio/carousel) — optional groups and checkbox
 * groups are add-ons, not part of what's being stocked. A combination
 * that already existed keeps its quantity; a new one starts at 0.
 *
 * Combinations are never hard-deleted once they have order history —
 * OrderItem.variantId is ON DELETE SET NULL, so deleting one would
 * silently detach past orders from what was actually bought. The same
 * rule applies one level up: a choice still referenced by any
 * combination (even an archived one) can't be deleted either, since that
 * combination's ProductVariantChoice row is what makes its meaning
 * legible later — it's archived instead.
 */
export async function writeOptionGroups(
  tx,
  productId,
  groups,
  trackOptionStock
) {
  const existingGroups = await tx.productOptionGroup.findMany({
    where: { productId },
    include: { choices: true },
  });
  const existingGroupById = new Map(existingGroups.map((g) => [g.id, g]));
  const existingChoiceById = new Map(
    existingGroups.flatMap((g) => g.choices.map((c) => [c.id, c]))
  );

  const incomingGroupIds = new Set();
  const incomingChoiceIds = new Set();
  // Per participating group, its final (post-upsert) choice list, for
  // building the combination matrix below.
  const participatingGroups = [];

  for (const [index, group] of groups.entries()) {
    const groupId =
      group.id && existingGroupById.has(group.id) ? group.id : null;
    const groupData = {
      name: group.name,
      inputType: group.inputType,
      required: group.required,
      setsPrice: group.setsPrice,
      sortOrder: index,
    };
    const resolvedGroupId = groupId
      ? (
          await tx.productOptionGroup.update({
            where: { id: groupId },
            data: groupData,
          })
        ).id
      : (
          await tx.productOptionGroup.create({
            data: { productId, ...groupData },
          })
        ).id;
    incomingGroupIds.add(resolvedGroupId);

    const finalChoices = [];
    for (const [ci, choice] of group.choices.entries()) {
      const price = group.setsPrice ? (choice.price ?? null) : null;
      const choiceId =
        choice.id && existingChoiceById.has(choice.id) ? choice.id : null;
      const choiceData = {
        label: choice.label,
        image: choice.image || null,
        price,
        sortOrder: ci,
      };
      const resolvedChoiceId = choiceId
        ? (
            await tx.productOptionChoice.update({
              where: { id: choiceId },
              data: choiceData,
            })
          ).id
        : (
            await tx.productOptionChoice.create({
              data: { groupId: resolvedGroupId, ...choiceData },
            })
          ).id;
      incomingChoiceIds.add(resolvedChoiceId);
      finalChoices.push({ id: resolvedChoiceId, label: choice.label });
    }

    if (group.required && !allowsMultiple(group.inputType)) {
      participatingGroups.push(finalChoices);
    }
  }

  if (trackOptionStock && participatingGroups.length === 0) {
    throw businessError(
      400,
      "Add at least one required option group (not checkboxes) before turning on option stock"
    );
  }

  const cellCount = participatingGroups.reduce((n, g) => n * g.length, 1);
  if (trackOptionStock && cellCount > MAX_COMBINATIONS) {
    throw businessError(
      400,
      `That's ${cellCount} combinations — please keep it under ${MAX_COMBINATIONS}`
    );
  }

  // --- Regenerate combinations ---
  const existingVariants = await tx.productVariant.findMany({
    where: { productId, archivedAt: null },
    include: { choices: true, orderItems: { take: 1, select: { id: true } } },
  });
  const existingByKey = new Map(
    existingVariants.map((v) => [
      combinationKey(v.choices.map((c) => c.choiceId)),
      v,
    ])
  );

  const wantedKeys = new Set();
  if (trackOptionStock) {
    for (const cell of cartesian(participatingGroups)) {
      const choiceIds = cell.map((c) => c.id);
      const key = combinationKey(choiceIds);
      wantedKeys.add(key);
      const name = cell.map((c) => c.label).join(" / ");
      const existing = existingByKey.get(key);
      if (existing) {
        // Quantity is untouched — only the label can go stale (a choice
        // was renamed since the combination was created).
        if (existing.name !== name) {
          await tx.productVariant.update({
            where: { id: existing.id },
            data: { name },
          });
        }
        continue;
      }
      const created = await tx.productVariant.create({
        data: { productId, name, price: null, quantity: 0 },
      });
      await tx.productVariantChoice.createMany({
        data: choiceIds.map((choiceId) => ({
          variantId: created.id,
          choiceId,
        })),
      });
    }
  }

  // Retire combinations no longer wanted — stock off, a participating
  // group's required/type changed, or one of its choices is gone.
  for (const variant of existingVariants) {
    const key = combinationKey(variant.choices.map((c) => c.choiceId));
    if (wantedKeys.has(key)) continue;
    if (variant.orderItems.length > 0) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { archivedAt: new Date() },
      });
    } else {
      // Cascades its ProductVariantChoice rows.
      await tx.productVariant.delete({ where: { id: variant.id } });
    }
  }

  // --- Remove groups/choices the admin dropped ---
  // Checked with a read, not a try/catch around delete: Postgres aborts
  // the whole transaction on a failed statement, so catching a
  // constraint violation here would poison every later write in this
  // same save, not just this one delete.
  for (const [choiceId, choice] of existingChoiceById) {
    if (incomingChoiceIds.has(choiceId) || choice.archivedAt) continue;
    const stillReferenced = await tx.productVariantChoice.count({
      where: { choiceId },
    });
    if (stillReferenced > 0) {
      await tx.productOptionChoice.update({
        where: { id: choiceId },
        data: { archivedAt: new Date() },
      });
    } else {
      await tx.productOptionChoice.delete({ where: { id: choiceId } });
    }
  }
  for (const group of existingGroups) {
    if (incomingGroupIds.has(group.id)) continue;
    // Only deletable once every choice under it is gone — an archived
    // choice left behind (still referenced by history) keeps the group
    // alive too, holding it.
    const remaining = await tx.productOptionChoice.count({
      where: { groupId: group.id },
    });
    if (remaining === 0) {
      await tx.productOptionGroup.delete({ where: { id: group.id } });
    }
  }
}

/**
 * Replaces the quantities on a product's existing stock combinations.
 * Never creates or removes a combination — that only happens via
 * writeOptionGroups, driven by the option matrix itself.
 */
export async function writeVariantStock(tx, productId, cells) {
  const existing = await tx.productVariant.findMany({
    where: { productId, archivedAt: null },
    select: { id: true },
  });
  const validIds = new Set(existing.map((v) => v.id));
  for (const cell of cells) {
    if (!validIds.has(cell.variantId)) {
      throw businessError(400, "That combination no longer exists");
    }
    await tx.productVariant.update({
      where: { id: cell.variantId },
      data: { quantity: cell.quantity },
    });
  }
}

export const variantStockSchema = z
  .array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().min(0).max(100000),
    })
  )
  .max(MAX_COMBINATIONS);
