import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, userInvitations } from '@/db/schema';
import { requireApprovedUser } from '@/lib/auth-utils';
import { sendInvitationSchema } from '@/lib/validation/user';
import { inviteLimiter } from '@/lib/rate-limiters';
import { sendEmail } from '@/lib/email';
import { invitationTemplate } from '@/lib/email-templates';
import { getBaseUrl } from '@/lib/token-service';
import { handleApiError } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const user = await requireApprovedUser();

    // Rate limit per user
    const rateLimitResult = inviteLimiter.check(user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'You have reached the invitation limit. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = sendInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // Check if email already registered
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 409 },
      );
    }

    // Create invitation token (72h)
    const token = crypto.randomBytes(32).toString('hex');
    await db.insert(userInvitations).values({
      token,
      invitedBy: user.id,
      invitedEmail: email,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    const inviteUrl = `${getBaseUrl()}/en/register?invitation=${token}`;
    await sendEmail(email, `${user.name} invited you to Omena`, invitationTemplate(user.name, inviteUrl));

    return NextResponse.json(
      { message: 'Invitation sent successfully' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'invitation-send');
  }
}
