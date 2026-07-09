const { PrismaClient } = require("@prisma/client");
const products = require("../scripts/seed-data");
const seedAdmin = require("../scripts/seed-admin");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Seeded ${products.length} products.`);
  await seedAdmin(prisma);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
