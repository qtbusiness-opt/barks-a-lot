const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const products = require("./seed-data");
const seedAdmin = require("./seed-admin");

async function main() {
  const env = process.env.NODE_ENV || "development";
  const dbUrl = process.env.DATABASE_URL;
  console.log(`Starting Barks-A-Lot [${env}]...`);
  console.log(`Database: ${dbUrl}`);

  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set!");
    process.exit(1);
  }

  console.log("Running migrations...");
  execSync("node node_modules/prisma/build/index.js migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });

  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    const count = await prisma.product.count();
    if (count === 0) {
      console.log("Seeding database...");
      for (const product of products) {
        await prisma.product.create({ data: product });
      }
      console.log(`Seeded ${products.length} products.`);
    } else {
      console.log(`Database already has ${count} products, skipping seed.`);
    }
    await seedAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log("Starting server...");
  require("../server.js");
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
