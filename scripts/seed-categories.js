// Idempotent: upserts the starter categories so existing products'
// category slugs always resolve. Admins manage the rest in the app.
async function seedCategories(prisma) {
  const categories = [
    { slug: "treats", name: "Treats", icon: "🦴", showsIngredients: true },
    { slug: "toys", name: "Toys", icon: "🧸", showsIngredients: false },
    { slug: "accessories", name: "Accessories", icon: "🎀", showsIngredients: false },
    { slug: "food", name: "Food", icon: "🥣", showsIngredients: true },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      // Admins may have renamed/re-iconed these — only the new flag is
      // kept in sync for the starters.
      update: { showsIngredients: category.showsIngredients },
      create: category,
    });
  }
  return categories.length;
}

module.exports = seedCategories;
