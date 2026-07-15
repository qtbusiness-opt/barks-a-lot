import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, brandedShell } from "@/lib/mailer";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
// Reset links are more sensitive — keep them short-lived.
const RESET_TTL_MS = 60 * 60 * 1000;

const hash = (token) => createHash("sha256").update(token).digest("hex");

// Creates a fresh single-use token for the user, invalidating any older
// tokens of the same purpose.
async function issueToken(userId, purpose, ttlMs) {
  const token = randomBytes(32).toString("base64url");

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId, purpose } }),
    prisma.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ]);

  return token;
}

// Looks up a live token of the given purpose; returns its record (with
// user) or null. Does not consume it — callers delete tokens after their
// side effects succeed.
async function findLiveToken(token, purpose) {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });

  if (!record || record.purpose !== purpose) return null;
  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { id: record.id } });
    return null;
  }
  return record;
}

export async function issueVerificationEmail(user, origin) {
  const token = await issueToken(user.id, "verify", VERIFY_TTL_MS);
  const base = process.env.APP_URL || origin;
  const url = `${base}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your Barks-A-Lot account",
    text: `Hi ${user.name},\n\nWelcome to Barks-A-Lot Treats & More! Click the link below to verify your email address and activate your account:\n\n${url}\n\nThis link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
    html: brandedShell(
      `<p>Hi ${user.name},</p><p>Welcome to Barks-A-Lot Treats &amp; More! Click the button below to verify your email address and activate your account:</p><p><a href="${url}" style="display:inline-block;background:#C8722A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verify My Email</a></p><p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
    ),
  });

  return url;
}

export async function consumeVerificationToken(token) {
  const record = await findLiveToken(token, "verify");
  if (!record) return null;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({
      where: { userId: record.userId, purpose: "verify" },
    }),
  ]);

  return user;
}

export async function issuePasswordResetEmail(user, origin) {
  const token = await issueToken(user.id, "reset", RESET_TTL_MS);
  const base = process.env.APP_URL || origin;
  const url = `${base}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Barks-A-Lot password",
    text: `Hi ${user.name},\n\nWe received a request to reset your Barks-A-Lot password. Click the link below to choose a new one:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request a reset, you can ignore this email — your password is unchanged.`,
    html: brandedShell(
      `<p>Hi ${user.name},</p><p>We received a request to reset your Barks-A-Lot password. Click the button below to choose a new one:</p><p><a href="${url}" style="display:inline-block;background:#4A7C8A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Reset My Password</a></p><p>This link expires in 1 hour. If you didn't request a reset, you can ignore this email — your password is unchanged.</p>`
    ),
  });

  return url;
}

// Returns the user a live reset token belongs to (without consuming it),
// or null. The reset route consumes tokens after the password is saved.
export async function findPasswordResetUser(token) {
  const record = await findLiveToken(token, "reset");
  return record?.user ?? null;
}

// Saves the new password hash, clears ALL of the user's tokens (a reset
// proves control of the inbox, so any pending verify token is moot), and
// marks the email verified.
export async function completePasswordReset(userId, hashedPassword) {
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({ where: { userId } }),
  ]);
  return user;
}
