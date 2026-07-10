import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(6).max(100),
});

export async function POST(req) {
  if (!rateLimit("register", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a name, a valid email, and a password of at least 6 characters" },
        { status: 400 }
      );
    }
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Role is always "customer" here — admin accounts are only created by
    // the seed process or promoted manually, never via public signup.
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    console.info(`[auth] account created user=${user.id}`);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    response.cookies.set("token", token, sessionCookieOptions(user.role));

    return response;
  } catch (err) {
    console.error("[auth] register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
