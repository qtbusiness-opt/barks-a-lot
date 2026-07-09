const { spawn } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const products = require("./seed-data");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log("Starting Barks-A-Lot [development]...");
  console.log(`Database: ${dbUrl}`);

  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set!");
    process.exit(1);
  }

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
