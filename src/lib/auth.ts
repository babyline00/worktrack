import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { employee: true },
        });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        await db.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId ?? "",
          employeeId: user.employeeId ?? "",
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.employeeId = (user as any).employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).employeeId = token.employeeId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "worktrack-dev-secret-change-me",
};
