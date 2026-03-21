import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/lib/auth';
import { loginSchema } from '@/lib/validation/user';
import { AuthError } from 'next-auth';
import { authLimiter } from '@/lib/rate-limiters';
import { logLogin } from '@/lib/login-logger';
import { getClientIp } from '@/lib/with-rate-limit';
import { db } from '@/db/connection';
import { users, admins } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || null;

  try {
    const rl = authLimiter.check(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    // Single lookup for both success and failure logging
    const [adminRows, userRows] = await Promise.all([
      db.select({ id: admins.id, isActive: admins.isActive }).from(admins)
        .where(and(eq(admins.email, email), isNull(admins.deletedAt))).limit(1),
      db.select({ id: users.id, accountStatus: users.accountStatus }).from(users)
        .where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1),
    ]);
    const admin = adminRows[0];
    const user = userRows[0];

    try {
      await signIn('user-credentials', {
        email,
        password,
        redirect: false,
      });

      await logLogin({
        userId: admin?.id || user?.id || null,
        userType: admin ? 'admin' : 'user',
        email,
        ipAddress: ip,
        userAgent,
        success: true,
      });

      return NextResponse.json({ message: 'Login successful' });
    } catch (error) {
      if (error instanceof AuthError) {
        let failReason = 'invalid_password';
        if (!admin && !user) {
          failReason = 'not_found';
        } else if (admin && !admin.isActive) {
          failReason = 'account_inactive';
        } else if (!admin && user && user.accountStatus !== 'approved') {
          failReason = 'account_inactive';
        }

        await logLogin({
          userId: admin?.id || user?.id || null,
          userType: admin ? 'admin' : 'user',
          email,
          ipAddress: ip,
          userAgent,
          success: false,
          failReason,
        });

        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 },
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }
    throw error;
  }
}
