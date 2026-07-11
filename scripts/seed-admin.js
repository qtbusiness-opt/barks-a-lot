const bcrypt = require("bcryptjs");

// Idempotent: creates the admin account if missing, otherwise ensures the
// existing account has the admin role. Credentials come from ADMIN_EMAIL /
// ADMIN_PASSWORD — override the defaults outside local development.
async function seedAdmin(prisma) {
  const email = process.env.ADMIN_EMAIL || "admin@barks-a-lot.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const hashed = await bcrypt.hash(password, 10);
  // Seeded admins are pre-verified — verification protects public signup.
  await prisma.user.upsert({
    where: { email },
    update: { role: "admin", emailVerified: new Date() },
    create: {
      email,
      password: hashed,
      name: "Store Admin",
      role: "admin",
      emailVerified: new Date(),
    },
  });

  console.log(`Admin account ready: ${email}`);
}

module.exports = seedAdmin;
