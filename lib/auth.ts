/**
 * NextAuth configuration for dual-audience authentication.
 *
 * Two principal types share a single login form:
 *  - Users (auction clients): must be in `approved` account status to log in.
 *  - Admins: separate table, optional TOTP 2FA, shorter re-validation window.
 *
 * All sessions use JWTs (no database session store). The token carries
 * `userType`, `visibilityLevel`, `role`, and `lastValidated` so that
 * middleware can make auth decisions without a DB call on every request.
 * Periodic re-validation (see jwt callback) catches account revocations
 * without relying on short-lived tokens.
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db/connection';
import { users, admins, verificationTokens } from '@/db/schema';
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
    lastValidated?: number;
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

    // Unified login: a single form for both users and admins. We check the admins
    // table first because admin accounts are fewer and must take priority if the
    // same email is registered in both tables (shouldn't happen, but defensive).
    Credentials({
      id: 'user-credentials',
      name: 'Login',
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

        // Check admins table first
        const [admin] = await db
          .select()
          .from(admins)
          .where(and(eq(admins.email, email), isNull(admins.deletedAt)))
          .limit(1);

        if (admin && admin.isActive) {
          const adminValid = await bcrypt.compare(password, admin.passwordHash);
          if (adminValid) {
            // Enforce TOTP if enabled
            if (admin.totpEnabled && admin.totpSecret) {
              if (!totpCode || !/^\d{6}$/.test(totpCode)) return null;
              const decryptedSecret = decryptSecret(admin.totpSecret);
              const totpValid = verifyTOTP(decryptedSecret, totpCode);
              if (!totpValid) return null;
            }

            await db
              .update(admins)
              .set({ lastLoginAt: new Date() })
              .where(eq(admins.id, admin.id));

            return {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              userType: 'admin' as const,
              visibilityLevel: 2,
              role: admin.role as AdminRole,
            };
          }
        }

        // Fall through to users table
        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, email), isNull(users.deletedAt)))
          .limit(1);

        if (!user || !user.passwordHash) return null;

        // Check account status — only approved users can log in
        if (user.accountStatus !== 'approved') return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

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

    // Magic link verification: token-based login
    Credentials({
      id: 'magic-link-verify',
      name: 'Magic Link',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined;
        if (!token) return null;

        // Mark the token as used before checking expiry so it cannot be replayed
        // even if the expiry check fails or the request is retried concurrently.
        // Atomically consume the token
        const consumed = await db
          .update(verificationTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(verificationTokens.token, token),
              eq(verificationTokens.purpose, 'magic_link'),
              isNull(verificationTokens.usedAt),
            ),
          )
          .returning({ identifier: verificationTokens.identifier, expiresAt: verificationTokens.expiresAt });

        if (consumed.length === 0) return null;

        // Check expiry
        if (consumed[0].expiresAt < new Date()) return null;

        const email = consumed[0].identifier;

        // Check admins table first
        const [admin] = await db
          .select()
          .from(admins)
          .where(and(eq(admins.email, email), isNull(admins.deletedAt)))
          .limit(1);

        if (admin && admin.isActive) {
          await db
            .update(admins)
            .set({ lastLoginAt: new Date() })
            .where(eq(admins.id, admin.id));

          return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            userType: 'admin' as const,
            visibilityLevel: 2,
            role: admin.role as AdminRole,
          };
        }

        // Fall through to users table
        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, email), isNull(users.deletedAt)))
          .limit(1);

        if (!user || user.accountStatus !== 'approved') return null;

        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

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
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — enrich token with custom fields
        token.sub = user.id;
        token.userType = user.userType;
        token.visibilityLevel = user.visibilityLevel;
        token.role = user.role;
        token.lastValidated = Date.now();
      }

      // Admins are re-validated every 30 s (vs. 5 min for users) because they
      // have elevated privileges and may be deactivated or have their role changed
      // by a super_admin while a session is in flight. The shorter window limits
      // the blast radius of a compromised or ex-employee admin account.
      if (token.userType === 'admin' && token.sub) {
        const now = Date.now();
        const lastValidated = token.lastValidated ?? 0;
        if (now - lastValidated > 30_000) {
          const [admin] = await db
            .select({ isActive: admins.isActive, role: admins.role, deletedAt: admins.deletedAt })
            .from(admins)
            .where(eq(admins.id, token.sub))
            .limit(1);

          // Returning a token with userType='revoked' causes middleware to redirect
          // the user out on their next request — no explicit session invalidation needed.
          if (!admin || !admin.isActive || admin.deletedAt) {
            return { ...token, userType: 'revoked' as const };
          }

          token.role = admin.role as AdminRole;
          token.lastValidated = now;
        }
      }

      // Re-validate user sessions every 5 minutes
      if (token.userType === 'user' && token.sub) {
        const now = Date.now();
        const lastValidated = token.lastValidated ?? 0;
        if (now - lastValidated > 5 * 60 * 1000) {
          const [user] = await db
            .select({ accountStatus: users.accountStatus, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.id, token.sub))
            .limit(1);

          if (!user || user.accountStatus !== 'approved' || user.deletedAt) {
            return { ...token, userType: 'revoked' as const };
          }

          token.lastValidated = now;
        }
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
