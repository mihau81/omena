import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { passwordResetRequestSchema } from '@/lib/validation/user';
import { passwordResetLimiter } from '@/lib/rate-limiters';
import { sendEmail } from '@/lib/email';
import { passwordReset } from '@/lib/email-templates';
import { createVerificationToken, getBaseUrl } from '@/lib/token-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = passwordResetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // Rate limit per email
    const rateLimitResult = passwordResetLimiter.check(email.toLowerCase());
    if (!rateLimitResult.success) {
      return NextResponse.json({ message: 'If an account exists, a password reset link has been sent.' });
    }

    // Lookup user — don't reveal if exists
    const [user] = await db
      .select({ id: users.id, name: users.name, accountStatus: users.accountStatus })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (!user || user.accountStatus !== 'approved') {
      return NextResponse.json({ message: 'If an account exists, a password reset link has been sent.' });
    }

    // Create reset token (1h)
    const token = await createVerificationToken(email, 'password_reset', 60 * 60 * 1000);
    const resetUrl = `${getBaseUrl()}/en/auth/reset-password?token=${token}`;
    await sendEmail(email, 'Reset your password — Omena', passwordReset(user.name, resetUrl));

    return NextResponse.json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('[password-reset] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
