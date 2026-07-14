const { PrismaClient } = require("@prisma/client");
const seedProducts = require("../scripts/seed-products");
const seedAdmin = require("../scripts/seed-admin");
const seedEvents = require("../scripts/seed-events");
const seedCategories = require("../scripts/seed-categories");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  await seedCategories(prisma);
  const seeded = await seedProducts(prisma);
  console.log(`Seeded ${seeded} products.`);
  await seedAdmin(prisma);
  await seedEvents(prisma);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
