import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  isValidAdminPassword,
  ADMIN_PASSWORD_RULES,
} from "@/lib/password-policy";

const adminUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().refine(isValidAdminPassword, {
    message: `Admin passwords need ${ADMIN_PASSWORD_RULES}`,
  }),
});

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
}

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = adminUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Please provide a name, a valid email, and a password with ${ADMIN_PASSWORD_RULES}` },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "That email already has an account" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Created by a trusted, signed-in admin — pre-verified, unlike public
    // customer signup.
    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "admin",
        emailVerified: new Date(),
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    console.info(`[admin] admin account created id=${admin.id} by=${auth.userId}`);
    return NextResponse.json({ admin }, { status: 201 });
  } catch (err) {
    console.error("[admin] admin create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
