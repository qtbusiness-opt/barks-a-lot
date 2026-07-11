import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

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
export const SESSION_SECONDS = {
  admin: 30 * 60,
  customer: 7 * 24 * 60 * 60,
};

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
        if (!rateLimit("login", request)) {
          console.warn("[auth] login rate limit hit");
          return null;
        }

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user && (await bcrypt.compare(password, user.password));
        if (!valid) {
          console.warn(`[auth] login failed email=${email}`);
          return null;
        }

        if (user.role !== "admin" && !user.emailVerified) {
          console.warn(`[auth] login blocked (unverified) user=${user.id}`);
          throw new EmailUnverified();
        }

        console.info(`[auth] login success user=${user.id} role=${user.role}`);
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
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.issuedAt = Math.floor(Date.now() / 1000);
      }
      const age = Math.floor(Date.now() / 1000) - (token.issuedAt ?? 0);
      if (token.role === "admin" && age > SESSION_SECONDS.admin) {
        return null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.issuedAt = token.issuedAt;
      return session;
    },
  },
});
