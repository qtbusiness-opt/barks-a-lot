const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const seedProducts = require("./seed-products");
const seedAdmin = require("./seed-admin");
const seedEvents = require("./seed-events");
const { directDatabaseUrl, redactDatabaseUrl } = require("./db-url");

// Run from the app root no matter where the process was launched from
// (Docker CMD, `npm start`, or a buildpack launcher).
const appRoot = path.join(__dirname, "..");
process.chdir(appRoot);

// The Next standalone server lives at the app root in the Docker image
// (the Dockerfile copies .next/standalone/* to /app), but at
// .next/standalone/ when running straight from a built checkout — e.g. a
// Cloud Run Buildpacks deploy or a local `npm run build && npm start`.
function resolveServer() {
  const dockerLayout = path.join(appRoot, "server.js");
  if (fs.existsSync(dockerLayout)) return dockerLayout;

  const standalone = path.join(appRoot, ".next", "standalone");
  const repoLayout = path.join(standalone, "server.js");
  if (fs.existsSync(repoLayout)) {
    // The standalone bundle expects static assets and public/ inside its
    // own directory; `next build` leaves them outside, so copy them in.
    fs.cpSync(
      path.join(appRoot, ".next", "static"),
      path.join(standalone, ".next", "static"),
      { recursive: true, force: true }
    );
    const publicDir = path.join(appRoot, "public");
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, path.join(standalone, "public"), {
        recursive: true,
        force: true,
      });
    }
    return repoLayout;
  }

  console.error(
    "ERROR: no standalone server found. Run `npm run build` first " +
      "(next.config.mjs uses output: 'standalone')."
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Migrations run against the direct (non-pooled) connection — see
// db-url.js. A cold serverless database can also refuse the first
// connection while it wakes, so a failed attempt is retried before the
// container gives up and the platform kills a healthy deploy.
async function runMigrations(migrationUrl) {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      execSync("node node_modules/prisma/build/index.js migrate deploy", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: migrationUrl },
      });
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      const delay = 2000 * attempt;
      console.warn(
        `Migration attempt ${attempt} of ${attempts} failed; retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }
}

async function main() {
  const env = process.env.NODE_ENV || "development";
  const dbUrl = process.env.DATABASE_URL;
  console.log(`Starting Barks-A-Lot [${env}]...`);
  // Redacted: the connection string carries the database password.
  console.log(`Database: ${redactDatabaseUrl(dbUrl)}`);
  console.log(`Port: ${process.env.PORT || 3000}`);

  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set!");
    process.exit(1);
  }

  const migrationUrl = directDatabaseUrl(
    dbUrl,
    process.env.DIRECT_DATABASE_URL
  );
  console.log("Running migrations...");
  if (migrationUrl !== dbUrl) {
    console.log(`Migrating via ${redactDatabaseUrl(migrationUrl)}`);
  }
  await runMigrations(migrationUrl);

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

  console.log("Starting server...");
  require(resolveServer());
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
