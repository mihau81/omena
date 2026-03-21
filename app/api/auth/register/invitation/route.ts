import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, userInvitations } from '@/db/schema';
import { registerInvitationSchema } from '@/lib/validation/user';
import { registrationLimiter } from '@/lib/rate-limiters';
import { getClientIpFromHeaders } from '@/lib/with-rate-limit';
import { sendEmail } from '@/lib/email';
import { emailVerification } from '@/lib/email-templates';
import { createVerificationToken, getBaseUrl } from '@/lib/token-service';

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const ip = getClientIpFromHeaders(headersList);
    const rateLimitResult = registrationLimiter.check(ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = registerInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, name, password, phone, invitationToken } = parsed.data;

    // Validate invitation token — atomically consume it
    const consumed = await db
      .update(userInvitations)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(userInvitations.token, invitationToken),
          isNull(userInvitations.usedAt),
        ),
      )
      .returning({
        id: userInvitations.id,
        invitedBy: userInvitations.invitedBy,
        invitedEmail: userInvitations.invitedEmail,
        expiresAt: userInvitations.expiresAt,
      });

    if (consumed.length === 0) {
      return NextResponse.json({ error: 'Invalid or already used invitation' }, { status: 400 });
    }

    const invitation = consumed[0];

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    if (invitation.invitedEmail.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match the invitation' }, { status: 400 });
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
        registrationSource: 'invitation',
        referrerId: invitation.invitedBy,
        accountStatus: 'pending_verification',
      })
      .returning({ id: users.id, email: users.email });

    // Link invitation to user
    await db
      .update(userInvitations)
      .set({ usedByUserId: newUser.id })
      .where(eq(userInvitations.id, invitation.id));

    // Create email verification token (24h)
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);
    const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${token}`;
    await sendEmail(email, 'Zweryfikuj swój email — Omenaa', emailVerification(name, verifyUrl, 'pl'));

    return NextResponse.json(
      { message: 'Account created. Please check your email to verify your address.', userId: newUser.id },
      { status: 201 },
    );
  } catch (error) {
    console.error('[register/invitation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
