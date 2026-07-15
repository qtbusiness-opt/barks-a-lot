import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, adminEmails } from "@/lib/mailer";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  message: z.string().trim().min(1).max(5000),
});

// Public Contact Us form: stores the message for the admin Messages page
// and emails every admin. Rate-limited to blunt spam bots.
export async function POST(req) {
  if (!rateLimit("contact", req)) {
    return NextResponse.json(
      { error: "Too many messages. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const parsed = contactSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fill out your name, a valid email, and a message." },
        { status: 400 }
      );
    }
    const { name, email, message } = parsed.data;

    const saved = await prisma.contactMessage.create({
      data: { name, email, message },
    });

    // Best-effort email to admins — the stored record is the source of
    // truth, so a mail failure never loses the message.
    try {
      const to = await adminEmails();
      if (to.length > 0) {
        await sendEmail({
          to,
          // reply_to would be ideal, but Resend needs it top-level; the
          // address is in the body so admins can reply directly.
          subject: `New contact message from ${name}`,
          text: `You have a new message from the Barks-A-Lot contact form.\n\nFrom: ${name} <${email}>\n\nMessage:\n${message}\n\nReply directly to ${email}. This message is also on the admin Messages page.`,
        });
      }
    } catch (err) {
      console.error(`[contact] admin email failed message=${saved.id}:`, err);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[contact] submit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
