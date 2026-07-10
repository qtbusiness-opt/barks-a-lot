import { auth, SESSION_SECONDS } from "@/auth";

// Single entry point for API routes to resolve the current user. Wraps
// Auth.js and re-enforces the short admin session window server-side so
// a stale admin token can never authorize an admin action.
export async function getAuthUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const age = Math.floor(Date.now() / 1000) - (user.issuedAt ?? 0);
  if (user.role === "admin" && age > SESSION_SECONDS.admin) {
    return null;
  }

  return { userId: user.id, email: user.email, role: user.role };
}
