import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { AdminRole } from "@prisma/client";

/**
 * Admin authentication: email + password.
 *
 * Care providers do NOT log in. They are identified via tokenized form URLs
 * (CampaignMember.token) sent over WhatsApp. The WhatsApp client in
 * `src/lib/ultramsg.ts` is used to deliver those links, not for admin auth.
 *
 * Session strategy: JWT. NextAuth v5's Credentials provider only supports JWT
 * sessions, not database sessions. JWT lives in an HTTP-only cookie signed by
 * NEXTAUTH_SECRET.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(creds?.password ?? "");

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // What we return becomes the JWT payload's `user` on first sign-in.
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, embed id + role + phone from the user row.
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: AdminRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role as AdminRole;
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
