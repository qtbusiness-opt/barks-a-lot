const products = require("./seed-data");

// Products with a `variants` array need a nested create so the variants
// land in their own table.
async function seedProducts(prisma) {
  for (const { variants, ...product } of products) {
    await prisma.product.create({
      data: {
        ...product,
        ...(variants ? { variants: { create: variants } } : {}),
      },
    });
  }
  return products.length;
}

module.exports = seedProducts;
