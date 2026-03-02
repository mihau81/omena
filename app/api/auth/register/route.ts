import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, userWhitelists } from '@/db/schema';
import { registerUserSchema } from '@/lib/validation/user';
import { registrationLimiter } from '@/lib/rate-limiters';
import { sendEmail } from '@/lib/email';
import { emailVerification } from '@/lib/email-templates';
import { createVerificationToken, getBaseUrl } from '@/lib/token-service';

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = registrationLimiter.check(ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = registerUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, name, password, phone } = parsed.data;

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // Check whitelist
    const [whitelistEntry] = await db
      .select({ id: userWhitelists.id })
      .from(userWhitelists)
      .where(and(eq(userWhitelists.email, email), isNull(userWhitelists.usedAt)))
      .limit(1);

    const registrationSource = whitelistEntry ? 'whitelist' : 'direct';
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        phone: phone || '',
        passwordHash,
        registrationSource,
        accountStatus: 'pending_verification',
      })
      .returning({ id: users.id, email: users.email });

    // Mark whitelist entry if found
    if (whitelistEntry) {
      await db
        .update(userWhitelists)
        .set({ usedAt: new Date(), userId: newUser.id })
        .where(eq(userWhitelists.id, whitelistEntry.id));
    }

    // Create email verification token (24h)
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);
    const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${token}`;
    await sendEmail(email, 'Verify your email — Omena', emailVerification(name, verifyUrl));

    return NextResponse.json(
      { message: 'Account created. Please check your email to verify your address.', userId: newUser.id },
      { status: 201 },
    );
  } catch (error) {
    console.error('[register] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
