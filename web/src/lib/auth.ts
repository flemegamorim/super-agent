import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getUserByEmail, getUserById } from "@/lib/db";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      mustChangePassword: boolean;
    };
  }

  interface User {
    mustChangePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    mustChangePassword: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = getUserByEmail(email);
        if (!user) return null;

        const valid = await compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          mustChangePassword: user.must_change_password === 1,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.mustChangePassword = user.mustChangePassword;
      }
      // On subsequent requests, re-check from DB so password change is reflected
      if (token.id && !user) {
        const dbUser = getUserById(token.id);
        if (dbUser) {
          token.mustChangePassword = dbUser.must_change_password === 1;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
});
