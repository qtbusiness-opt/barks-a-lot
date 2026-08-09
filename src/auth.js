import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logEvent, clientIp } from "@/lib/log";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Distinguishable from a bad password so the login page can offer to
// resend the verification email. Only thrown AFTER the password checks
// out, so it doesn't leak whether an email has an account.
class EmailUnverified extends CredentialsSignin {
  code = "email-unverified";
}

// Admin sessions are kept short (CLAUDE.md §1); customers get a longer
// "remember me" window. The global maxAge covers customers; admin expiry
// is enforced via the issuedAt claim in the jwt callback and getAuthUser.
//
// This is an IDLE window, not a session's whole life: the browser renews
// it as the user works (and when they answer the expiry warning), so it
// measures time since the last thing they did. An unattended browser
// still times out, because nothing renews on its own.
//
// ADMIN_SESSION_SECONDS shortens it outside production so the warning
// modal can be exercised without waiting half an hour. Deliberately
// ignored in production: a misconfigured env var must never be able to
// stretch an admin session.
const adminOverride = Number(process.env.ADMIN_SESSION_SECONDS);
export const SESSION_SECONDS = {
  admin:
    process.env.NODE_ENV !== "production" && adminOverride > 0
      ? adminOverride
      : 30 * 60,
  customer: 7 * 24 * 60 * 60,
};

export const sessionLimitFor = (role) =>
  role === "admin" ? SESSION_SECONDS.admin : SESSION_SECONDS.customer;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.JWT_SECRET,
  // Self-hosted (Docker) deployment — the Host header is ours to trust.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_SECONDS.customer,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        const ip = clientIp(request);

        if (!rateLimit("login", request)) {
          await logEvent({
            level: "warn",
            category: "auth",
            event: "login_rate_limited",
            message: "Login rate limit hit",
            ip,
          });
          return null;
        }

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user && (await bcrypt.compare(password, user.password));
        if (!valid) {
          await logEvent({
            level: "warn",
            category: "auth",
            event: "login_failed",
            message: "Incorrect email or password",
            email,
            ip,
          });
          return null;
        }

        if (user.role !== "admin" && !user.emailVerified) {
          await logEvent({
            level: "warn",
            category: "auth",
            event: "login_unverified",
            message: "Login blocked — email not verified",
            email,
            userId: user.id,
            ip,
          });
          throw new EmailUnverified();
        }

        await logEvent({
          category: "auth",
          event: "login_success",
          message: `${user.role} signed in`,
          email: user.email,
          userId: user.id,
          ip,
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      const now = Math.floor(Date.now() / 1000);
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.issuedAt = now;
      }
      // useSession().update({ name }) after a profile edit lands here.
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      // Expiry is checked BEFORE the extension below, so answering the
      // warning too late (or replaying an update on a stale token) can
      // never resurrect a session that has already run out.
      const age = now - (token.issuedAt ?? 0);
      if (token.role === "admin" && age > SESSION_SECONDS.admin) {
        return null;
      }

      // The sliding idle window: the browser renews an active session as
      // the user works, and "Stay signed in" on the expiry warning does
      // the same. Either way it only restarts a clock still running.
      if (trigger === "update" && session?.extend) {
        token.issuedAt = now;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.issuedAt = token.issuedAt;
      // When this session runs out (epoch seconds), so the browser can
      // warn ahead of time without duplicating the policy client-side.
      session.user.expiresAt =
        (token.issuedAt ?? 0) + sessionLimitFor(token.role);
      return session;
    },
  },
});
