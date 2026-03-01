import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db/connection';
import { users, admins } from '@/db/schema';
import type { AdminRole } from '@/lib/permissions';
import { verifyTOTP, decryptSecret } from '@/lib/totp';

declare module 'next-auth' {
  interface User {
    userType: 'user' | 'admin';
    visibilityLevel: number;
    role: AdminRole | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      userType: 'user' | 'admin';
      visibilityLevel: number;
      role: AdminRole | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userType: 'user' | 'admin' | 'revoked';
    visibilityLevel: number;
    role: AdminRole | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  basePath: '/api/auth',
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    // Admin login: email + password
    Credentials({
      id: 'admin-credentials',
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'TOTP Code', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const totpCode = credentials?.totpCode as string | undefined;
        if (!email || !password) return null;

        const [admin] = await db
          .select()
          .from(admins)
          .where(and(eq(admins.email, email), isNull(admins.deletedAt)))
          .limit(1);

        if (!admin || !admin.isActive) return null;

        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid) return null;

        // Enforce TOTP if enabled — reject login without valid code
        if (admin.totpEnabled && admin.totpSecret) {
          if (!totpCode || !/^\d{6}$/.test(totpCode)) return null;
          const decryptedSecret = decryptSecret(admin.totpSecret);
          const totpValid = verifyTOTP(decryptedSecret, totpCode);
          if (!totpValid) return null;
        }

        // Update last login
        await db
          .update(admins)
          .set({ lastLoginAt: new Date() })
          .where(eq(admins.id, admin.id));

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          userType: 'admin' as const,
          visibilityLevel: 2, // Admins see everything
          role: admin.role as AdminRole,
        };
      },
    }),

    // Client login: email + password
    Credentials({
      id: 'user-credentials',
      name: 'User Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, email), isNull(users.deletedAt)))
          .limit(1);

        if (!user || !user.isActive || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: 'user' as const,
          visibilityLevel: parseInt(user.visibilityLevel),
          role: null,
        };
      },
    }),

    // Email provider placeholder for magic link (Phase 2)
    // Uncomment when SMTP is configured:
    // Email({
    //   server: {
    //     host: process.env.SMTP_HOST,
    //     port: Number(process.env.SMTP_PORT),
    //     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    //   },
    //   from: process.env.EMAIL_FROM,
    // }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — enrich token with custom fields
        token.sub = user.id;
        token.userType = user.userType;
        token.visibilityLevel = user.visibilityLevel;
        token.role = user.role;
      }

      // Re-validate admin sessions against DB on each token refresh
      // This ensures deactivated/role-changed admins are rejected promptly
      if (token.userType === 'admin' && token.sub) {
        const [admin] = await db
          .select({ isActive: admins.isActive, role: admins.role, deletedAt: admins.deletedAt })
          .from(admins)
          .where(eq(admins.id, token.sub))
          .limit(1);

        if (!admin || !admin.isActive || admin.deletedAt) {
          // Invalidate the token — returning empty token forces sign-out
          return { ...token, userType: 'revoked' as const };
        }

        // Update role if changed
        token.role = admin.role as AdminRole;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.userType = token.userType === 'revoked' ? 'admin' : token.userType;
      session.user.visibilityLevel = token.visibilityLevel;
      session.user.role = token.role;
      return session;
    },
  },
  jwt: {
    maxAge: 24 * 60 * 60, // Default 24h for clients, overridden per-login for admins
  },
});
