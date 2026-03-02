import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, qrRegistrations } from '@/db/schema';
import { registerQrSchema } from '@/lib/validation/user';
import { registrationLimiter } from '@/lib/rate-limiters';
import { sendEmail } from '@/lib/email';
import { emailVerification } from '@/lib/email-templates';
import { createVerificationToken, getBaseUrl } from '@/lib/token-service';

export async function POST(request: Request) {
  try {
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
    const parsed = registerQrSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, name, password, phone, qrCode } = parsed.data;

    // Validate QR code
    const [qr] = await db
      .select()
      .from(qrRegistrations)
      .where(and(eq(qrRegistrations.code, qrCode), eq(qrRegistrations.isActive, true)))
      .limit(1);

    if (!qr) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    const now = new Date();
    if (now < qr.validFrom || now > qr.validUntil) {
      return NextResponse.json({ error: 'This QR code has expired or is not yet active' }, { status: 400 });
    }

    if (qr.maxUses !== null && qr.useCount >= qr.maxUses) {
      return NextResponse.json({ error: 'This QR code has reached its usage limit' }, { status: 400 });
    }

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

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        phone: phone || '',
        passwordHash,
        registrationSource: 'qr_code',
        qrRegistrationId: qr.id,
        accountStatus: 'pending_verification',
      })
      .returning({ id: users.id, email: users.email });

    // Increment QR use count
    await db
      .update(qrRegistrations)
      .set({ useCount: sql`${qrRegistrations.useCount} + 1` })
      .where(eq(qrRegistrations.id, qr.id));

    // Create email verification token (24h)
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);
    const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${token}`;
    await sendEmail(email, 'Verify your email — Omena', emailVerification(name, verifyUrl));

    return NextResponse.json(
      { message: 'Account created. Please check your email to verify your address.', userId: newUser.id },
      { status: 201 },
    );
  } catch (error) {
    console.error('[register/qr] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
