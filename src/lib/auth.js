import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// Admin sessions are kept short (CLAUDE.md §1); customers get a longer
// "remember me" window. Cookie maxAge must match the JWT expiry so the
// browser doesn't send tokens that are already dead.
export const SESSION_SECONDS = {
  admin: 30 * 60,
  customer: 7 * 24 * 60 * 60,
};

export function sessionSeconds(role) {
  return role === "admin" ? SESSION_SECONDS.admin : SESSION_SECONDS.customer;
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: sessionSeconds(payload.role),
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function sessionCookieOptions(role) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: sessionSeconds(role),
    path: "/",
  };
}
