import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const hash = (token) => createHash("sha256").update(token).digest("hex");

// Creates a fresh verification token for the user (invalidating old ones)
// and emails the link. Returns the URL so dev environments without an
// email provider can surface it.
export async function issueVerificationEmail(user, origin) {
  const token = randomBytes(32).toString("base64url");

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const base = process.env.APP_URL || origin;
  const url = `${base}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your Barks-A-Lot account",
    text: `Hi ${user.name},\n\nWelcome to Barks-A-Lot Treats & More! Click the link below to verify your email address and activate your account:\n\n${url}\n\nThis link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Welcome to Barks-A-Lot Treats &amp; More! Click the button below to verify your email address and activate your account:</p><p><a href="${url}" style="display:inline-block;background:#C8722A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verify My Email</a></p><p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
  });

  return url;
}

// Consumes a token: marks the user verified and deletes their tokens.
// Returns the user, or null when the token is unknown or expired.
export async function consumeVerificationToken(token) {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });

  if (!record) return null;
  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { id: record.id } });
    return null;
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return user;
}
