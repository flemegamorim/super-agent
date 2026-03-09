import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config (no Node.js imports).
 * Used by middleware. The full config in auth.ts extends this with DB-backed providers.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.id;
      (session.user as any).mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
} satisfies NextAuthConfig;
