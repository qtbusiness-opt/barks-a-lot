// Hardened password policy for admin accounts (customers keep the lighter
// 6-character minimum): at least 8 characters with a letter and a number.
// scripts/seed-admin.js enforces the same rule for the seeded account.
export const ADMIN_PASSWORD_RULES =
  "at least 8 characters, including a letter and a number";

export function isValidAdminPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
