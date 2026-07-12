import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { issuePasswordResetEmail } from "@/lib/verification";
import { emailConfigured } from "@/lib/mailer";

const forgotSchema = z.object({ email: z.email() });

export async function POST(req) {
  if (!rateLimit("forgot-password", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const parsed = forgotSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    // Always answer identically so this can't probe which emails have
    // accounts.
    let devResetUrl;
    if (user) {
      const url = await issuePasswordResetEmail(user, new URL(req.url).origin);
      console.info(`[auth] password reset requested user=${user.id}`);
      if (!emailConfigured && process.env.NODE_ENV !== "production") {
        devResetUrl = url;
      }
    }

    return NextResponse.json({
      message: "If that email has an account, a reset link is on its way.",
      ...(devResetUrl ? { devResetUrl } : {}),
    });
  } catch (err) {
    console.error("[auth] forgot password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
