import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import {
  findPasswordResetUser,
  completePasswordReset,
} from "@/lib/verification";
import {
  isValidAdminPassword,
  ADMIN_PASSWORD_RULES,
} from "@/lib/password-policy";

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(6).max(100),
});

export async function POST(req) {
  if (!rateLimit("reset-password", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const parsed = resetSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Passwords need at least 6 characters" },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;

    const user = await findPasswordResetUser(token);
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    // Admin accounts keep their hardened policy even through resets.
    if (user.role === "admin" && !isValidAdminPassword(password)) {
      return NextResponse.json(
        { error: `Admin passwords need ${ADMIN_PASSWORD_RULES}` },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await completePasswordReset(user.id, hashedPassword);

    console.info(`[auth] password reset completed user=${user.id}`);
    return NextResponse.json({ reset: true });
  } catch (err) {
    console.error("[auth] reset password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
