import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, admins } from '@/db/schema';
import { magicLinkRequestSchema } from '@/lib/validation/user';
import { magicLinkLimiter } from '@/lib/rate-limiters';
import { sendEmail } from '@/lib/email';
import { magicLinkLogin } from '@/lib/email-templates';
import { createVerificationToken, getBaseUrl } from '@/lib/token-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = magicLinkRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, locale } = parsed.data;

    // Rate limit per email — always return 200 to not leak existence
    const rateLimitResult = magicLinkLimiter.check(email.toLowerCase());
    if (!rateLimitResult.success) {
      // Still return 200 to not reveal rate limit was per-email
      return NextResponse.json({ message: 'If an account exists, a sign-in link has been sent.' });
    }

    // Lookup user or admin — don't reveal if exists
    const [user] = await db
      .select({ id: users.id, accountStatus: users.accountStatus })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    const [admin] = await db
      .select({ id: admins.id, isActive: admins.isActive })
      .from(admins)
      .where(and(eq(admins.email, email), isNull(admins.deletedAt)))
      .limit(1);

    const userFound = user && user.accountStatus === 'approved';
    const adminFound = admin && admin.isActive;

    if (!userFound && !adminFound) {
      // Don't reveal account doesn't exist — always return success
      return NextResponse.json({ message: 'If an account exists, a sign-in link has been sent.' });
    }

    // Create magic link token (15 min)
    const token = await createVerificationToken(email, 'magic_link', 15 * 60 * 1000);
    const magicUrl = `${getBaseUrl()}/${locale}/auth/magic-link?token=${token}`;
    const subject = locale === 'pl' ? 'Zaloguj się do Omenaa' : 'Sign in to Omenaa';
    await sendEmail(email, subject, magicLinkLogin(email, magicUrl, locale));

    return NextResponse.json({ message: 'If an account exists, a sign-in link has been sent.' });
  } catch (error) {
    console.error('[magic-link] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
