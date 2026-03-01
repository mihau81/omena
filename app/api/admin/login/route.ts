import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyTOTP, decryptSecret } from '@/lib/totp';
import { authLimiter } from '@/lib/rate-limiters';

const adminLoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = authLimiter.check(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password, totpCode } = parsed.data;

    // Find admin
    const [admin] = await db
      .select()
      .from(admins)
      .where(and(eq(admins.email, email), isNull(admins.deletedAt)))
      .limit(1);

    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if TOTP is required
    if (admin.totpEnabled && !admin.totpSecret) {
      // Should not happen, but handle edge case
      return NextResponse.json(
        { error: 'TOTP configuration error' },
        { status: 500 }
      );
    }

    if (admin.totpEnabled) {
      if (!totpCode) {
        // TOTP is required but not provided
        return NextResponse.json(
          { requiresTOTP: true, email },
          { status: 200 }
        );
      }

      // Verify TOTP code
      const decryptedSecret = decryptSecret(admin.totpSecret!);
      const totpValid = verifyTOTP(decryptedSecret, totpCode);

      if (!totpValid) {
        return NextResponse.json(
          { error: 'Invalid TOTP code' },
          { status: 401 }
        );
      }
    }

    // Password and TOTP (if required) are valid
    // Session creation happens via the Auth.js callback endpoint (called by the client-side signIn)

    // Update last login
    await db
      .update(admins)
      .set({ lastLoginAt: new Date() })
      .where(eq(admins.id, admin.id));

    return NextResponse.json(
      { ok: true, message: 'Signed in successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
