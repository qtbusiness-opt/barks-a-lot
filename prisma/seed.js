const { PrismaClient } = require("@prisma/client");
const seedProducts = require("../scripts/seed-products");
const seedAdmin = require("../scripts/seed-admin");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  const seeded = await seedProducts(prisma);
  console.log(`Seeded ${seeded} products.`);
  await seedAdmin(prisma);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
