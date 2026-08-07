const { spawn } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const seedProducts = require("./seed-products");
const seedAdmin = require("./seed-admin");
const seedEvents = require("./seed-events");
const { redactDatabaseUrl } = require("./db-url");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log("Starting Barks-A-Lot [development]...");
  // Redacted: the connection string carries the database password.
  console.log(`Database: ${redactDatabaseUrl(dbUrl)}`);

  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set!");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    const count = await prisma.product.count();
    if (count === 0) {
      console.log("Seeding database...");
      const seeded = await seedProducts(prisma);
      console.log(`Seeded ${seeded} products.`);
    } else {
      console.log(`Database already has ${count} products, skipping seed.`);
    }
    await seedAdmin(prisma);
    await seedEvents(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log("Starting Next.js dev server...");
  const child = spawn("npx", ["next", "dev", "--hostname", "0.0.0.0"], {
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("exit", (code) => process.exit(code || 0));
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
