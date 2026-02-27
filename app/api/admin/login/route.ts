import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/lib/auth';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyTOTP, decryptSecret } from '@/lib/totp';

export async function POST(req: NextRequest) {
  try {
    const { email, password, totpCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

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
    // Use NextAuth's signIn to create the session
    const result = await signIn('admin-credentials', {
      email,
      password,
      redirect: false,
    });

    if (!result || !result.ok) {
      return NextResponse.json(
        { error: 'Sign-in failed' },
        { status: 401 }
      );
    }

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
