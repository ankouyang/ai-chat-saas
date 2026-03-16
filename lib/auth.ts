import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "邮箱登录",
      credentials: {
        email: {
          label: "邮箱",
          type: "email",
        },
        name: {
          label: "昵称",
          type: "text",
        },
      },
      async authorize(credentials) {
        if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
          return null;
        }

        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const name =
          typeof credentials?.name === "string"
            ? credentials.name.trim()
            : "";

        if (!email) {
          return null;
        }

        const user = await prisma.user.upsert({
          where: { email },
          update: {
            name: name || undefined,
          },
          create: {
            email,
            name: name || email.split("@")[0],
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }

      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};

export function auth() {
  return getServerSession(authOptions);
}
