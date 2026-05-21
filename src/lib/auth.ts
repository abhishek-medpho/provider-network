import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { sendWhatsAppLoginLink } from "@/lib/ultramsg";

/**
 * Custom Prisma adapter that uses `phone` (not `email`) as the user identifier.
 *
 * NextAuth's email/magic-link flow assumes the identifier is an email address
 * and that the User table has an `email` column. We override the relevant
 * adapter methods so that the same flow works with a phone number stored in
 * the `phone` column.
 *
 * Result: NextAuth sees "email" everywhere internally; under the hood we
 * read/write `phone`. The User table still has a nullable `email` column for
 * any future use.
 */
function whatsappAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,

    async createUser(user) {
      // user.email is the normalized phone (set by normalizeIdentifier)
      const phone = user.email!;
      const created = await prisma.user.create({
        data: {
          phone,
          name: user.name ?? null,
          image: user.image ?? null,
          emailVerified: user.emailVerified,
          role: "VIEWER",
        },
      });
      return userToAdapter(created);
    },

    async getUserByEmail(phone) {
      const u = await prisma.user.findUnique({ where: { phone } });
      return u ? userToAdapter(u) : null;
    },

    async getUser(id) {
      const u = await prisma.user.findUnique({ where: { id } });
      return u ? userToAdapter(u) : null;
    },

    async updateUser(user) {
      const { id, ...rest } = user;
      if (!id) throw new Error("updateUser requires id");
      const data: Record<string, unknown> = {};
      if (rest.name !== undefined) data.name = rest.name;
      if (rest.image !== undefined) data.image = rest.image;
      if (rest.emailVerified !== undefined)
        data.emailVerified = rest.emailVerified;
      // If NextAuth tries to update "email", it's actually the phone identifier.
      if (rest.email !== undefined) data.phone = rest.email;
      const updated = await prisma.user.update({ where: { id }, data });
      return userToAdapter(updated);
    },
  };
}

function userToAdapter(u: {
  id: string;
  phone: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
}): AdapterUser {
  // NextAuth requires `email` on AdapterUser. We surface phone as email
  // throughout NextAuth's internal flow.
  return {
    id: u.id,
    email: u.phone,
    emailVerified: u.emailVerified,
    name: u.name,
    image: u.image,
  };
}

export const authConfig: NextAuthConfig = {
  adapter: whatsappAdapter(),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    {
      id: "whatsapp",
      name: "WhatsApp",
      type: "email",
      maxAge: Number(process.env.WHATSAPP_LOGIN_LINK_TTL_MIN ?? "15") * 60,
      normalizeIdentifier: (identifier: string) => normalizePhone(identifier),
      async sendVerificationRequest({
        identifier: phone,
        url,
      }: {
        identifier: string;
        url: string;
      }) {
        // Allowlist gate: only admins (existing users OR phones in
        // ADMIN_ALLOWED_PHONES) can request a magic link. Prevents Ultramsg
        // abuse and accidental DOS.
        const allowed = (process.env.ADMIN_ALLOWED_PHONES ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const existingUser = await prisma.user.findUnique({ where: { phone } });
        const isAllowed =
          (existingUser?.active ?? false) ||
          allowed.includes(phone);

        if (!isAllowed) {
          throw new Error(
            "This phone is not authorized for admin access. Contact a Super Admin.",
          );
        }

        await sendWhatsAppLoginLink(phone, url);
      },
    },
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/check-whatsapp",
    error: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      // Expose phone + role on the session so admin UI can use them.
      const u = await prisma.user.findUnique({ where: { id: user.id } });
      if (u) {
        session.user = {
          ...session.user,
          id: u.id,
          name: u.name ?? null,
          image: u.image ?? null,
          // Re-introduce phone — NextAuth has been treating it as email
          phone: u.phone,
          role: u.role,
        } as typeof session.user & {
          id: string;
          phone: string;
          role: typeof u.role;
        };
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
