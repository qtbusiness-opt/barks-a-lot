const bcrypt = require("bcryptjs");

// Idempotent: creates the admin account if missing, otherwise ensures the
// existing account has the admin role. Credentials come from ADMIN_EMAIL /
// ADMIN_PASSWORD — override the defaults outside local development.
async function seedAdmin(prisma) {
  const email = process.env.ADMIN_EMAIL || "admin@barks-a-lot.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  // Same hardened policy as src/lib/password-policy.js (that module is
  // ESM; this script is CJS): 8+ characters with a letter and a number.
  // Failing fast beats silently seeding a weak admin credential.
  const strongEnough =
    password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  if (!strongEnough) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 8 characters and include a letter and a number"
    );
  }

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
