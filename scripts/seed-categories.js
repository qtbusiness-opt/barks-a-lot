// Idempotent: upserts the starter categories so existing products'
// category slugs always resolve. Admins manage the rest in the app.
async function seedCategories(prisma) {
  const categories = [
    { slug: "treats", name: "Treats", icon: "🦴" },
    { slug: "toys", name: "Toys", icon: "🧸" },
    { slug: "accessories", name: "Accessories", icon: "🎀" },
    { slug: "food", name: "Food", icon: "🥣" },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
  return categories.length;
}

module.exports = seedCategories;
