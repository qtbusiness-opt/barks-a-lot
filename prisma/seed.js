const { PrismaClient } = require("@prisma/client");
const products = require("../scripts/seed-data");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
