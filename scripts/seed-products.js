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

// Products with `variants` or `optionGroups` need nested creates so the
// rows land in their own tables.
async function seedProducts(prisma) {
  for (const { variants, optionGroups, ...product } of products) {
    await prisma.product.create({
      data: {
        ...product,
        slug: slugify(product.name),
        ...(variants ? { variants: { create: variants } } : {}),
        ...(optionGroups
          ? {
              optionGroups: {
                create: optionGroups.map((g, gi) => ({
                  name: g.name,
                  inputType: g.inputType,
                  required: g.required ?? true,
                  sortOrder: gi,
                  choices: {
                    create: g.choices.map((c, ci) => ({
                      label: c.label,
                      image: c.image ?? null,
                      sortOrder: ci,
                    })),
                  },
                })),
              },
            }
          : {}),
      },
    });
  }
  return products.length;
}

module.exports = seedProducts;
