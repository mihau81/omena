import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, userInvitations } from '@/db/schema';
import { requireApprovedUser, AuthError } from '@/lib/auth-utils';

// ─── GET /api/me/referral ────────────────────────────────────────────────────
// Returns referral link info and counts

export async function GET() {
  try {
    const sessionUser = await requireApprovedUser();

    // Count direct referrals (users who signed up with referrerId = current user)
    const directReferrals = await db
      .select({ id: users.id, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.referrerId, sessionUser.id), isNull(users.deletedAt)));

    // Count pending invitations
    const sentInvitations = await db
      .select({ id: userInvitations.id, invitedEmail: userInvitations.invitedEmail, usedAt: userInvitations.usedAt })
      .from(userInvitations)
      .where(eq(userInvitations.invitedBy, sessionUser.id));

    return NextResponse.json({
      referralCode: sessionUser.id,
      referralCount: directReferrals.length,
      invitationsSent: sentInvitations.length,
      invitationsUsed: sentInvitations.filter((i) => i.usedAt !== null).length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/referral] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
