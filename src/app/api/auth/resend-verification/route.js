import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { issueVerificationEmail } from "@/lib/verification";

const resendSchema = z.object({ email: z.email() });

export async function POST(req) {
  if (!rateLimit("resend-verification", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const parsed = resendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    // Only send when the account exists and still needs verifying — but
    // always answer the same way, so this can't be used to probe which
    // emails have accounts.
    if (user && !user.emailVerified) {
      await issueVerificationEmail(user, new URL(req.url).origin);
    }

    return NextResponse.json({
      message: "If that email needs verification, a new link is on its way.",
    });
  } catch (err) {
    console.error("[auth] resend verification error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
