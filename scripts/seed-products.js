const products = require("./seed-data");

// Same rule as src/lib/slug.js — duplicated because the seed scripts are
// plain CommonJS and can't import the app's ES modules.
const slugify = (name) =>
  String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// Cartesian product of choice arrays, one per participating group. Same
// rule as src/lib/option-writes.js (required, single-select groups only)
// and the same combinatorics — duplicated for the same CommonJS reason
// as slugify above, not because the logic is meant to diverge.
function cartesian(groupsOfChoices) {
  return groupsOfChoices.reduce(
    (cells, choices) =>
      cells.flatMap((cell) => choices.map((c) => [...cell, c])),
    [[]]
  );
}

// Products with `variants` or `optionGroups` need nested creates so the
// rows land in their own tables. trackOptionStock products additionally
// get their combination matrix generated afterward, once the groups'
// real choice ids exist to link — variantStock keys them by the same
// "Choice / Choice" name the write path generates.
async function seedProducts(prisma) {
  for (const {
    variants,
    optionGroups,
    trackOptionStock,
    variantStock,
    ...product
  } of products) {
    const created = await prisma.product.create({
      data: {
        ...product,
        trackOptionStock: trackOptionStock ?? false,
        slug: slugify(product.name),
        ...(variants ? { variants: { create: variants } } : {}),
        ...(optionGroups
          ? {
              optionGroups: {
                create: optionGroups.map((g, gi) => ({
                  name: g.name,
                  inputType: g.inputType,
                  required: g.required ?? true,
                  setsPrice: g.setsPrice ?? false,
                  sortOrder: gi,
                  choices: {
                    create: g.choices.map((c, ci) => ({
                      label: c.label,
                      image: c.image ?? null,
                      price: c.price ?? null,
                      sortOrder: ci,
                    })),
                  },
                })),
              },
            }
          : {}),
      },
      include: { optionGroups: { include: { choices: true } } },
    });

    if (trackOptionStock && variantStock) {
      const participating = created.optionGroups.filter(
        (g) => g.required && g.inputType !== "checkbox"
      );
      let totalStock = 0;
      for (const cell of cartesian(participating.map((g) => g.choices))) {
        const name = cell.map((c) => c.label).join(" / ");
        const quantity = variantStock[name] ?? 0;
        totalStock += quantity;
        const variant = await prisma.productVariant.create({
          data: { productId: created.id, name, price: null, quantity },
        });
        await prisma.productVariantChoice.createMany({
          data: cell.map((c) => ({ variantId: variant.id, choiceId: c.id })),
        });
      }
      await prisma.product.update({
        where: { id: created.id },
        data: { inStock: totalStock > 0 },
      });
    }
  }
  return products.length;
}

module.exports = seedProducts;
