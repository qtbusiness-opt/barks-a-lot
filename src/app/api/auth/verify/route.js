import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeVerificationToken } from "@/lib/verification";
import { rateLimit } from "@/lib/rate-limit";

const verifySchema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req) {
  if (!rateLimit("verify", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    const user = await consumeVerificationToken(parsed.data.token);
    if (!user) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired." },
        { status: 400 }
      );
    }

    console.info(`[auth] email verified user=${user.id}`);
    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("[auth] verify error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
