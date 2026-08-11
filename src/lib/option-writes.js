// Admin-side writing of product option groups. Kept out of options.js so
// the storefront helpers stay free of zod and Prisma.
import { z } from "zod";
import { OPTION_INPUT_TYPES } from "@/lib/options";

export const optionGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  inputType: z.enum(OPTION_INPUT_TYPES),
  required: z.boolean().default(true),
  choices: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        // Thumbnail for carousel groups; ignored by the other types.
        image: z.string().trim().max(300).nullish(),
      })
    )
    .min(1)
    .max(20),
});

/**
 * Replaces a product's option groups wholesale. Groups carry no stock or
 * price and order items keep a snapshot of the labels, so rewriting them
 * can't disturb inventory or rewrite order history. Must run inside a
 * transaction (`tx`).
 */
export async function writeOptionGroups(tx, productId, groups) {
  // Choices cascade from the group rows.
  await tx.productOptionGroup.deleteMany({ where: { productId } });

  for (const [index, group] of groups.entries()) {
    await tx.productOptionGroup.create({
      data: {
        productId,
        name: group.name,
        inputType: group.inputType,
        required: group.required,
        sortOrder: index,
        choices: {
          create: group.choices.map((choice, i) => ({
            label: choice.label,
            image: choice.image || null,
            sortOrder: i,
          })),
        },
      },
    });
  }
}
