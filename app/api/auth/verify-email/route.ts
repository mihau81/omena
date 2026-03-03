import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users, admins } from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { accountApproved, pendingApproval, adminNewUserPending } from '@/lib/email-templates';
import { consumeToken, getBaseUrl } from '@/lib/token-service';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return redirectToStatus('invalid');
    }

    // Atomically consume the token
    const consumed = await consumeToken(token, 'email_verification');
    if (!consumed) {
      return redirectToStatus('invalid');
    }

    const email = consumed.identifier;

    // Find and update user
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      return redirectToStatus('invalid');
    }

    // Already verified
    if (user.emailVerified) {
      return redirectToStatus('already-verified');
    }

    // Determine new status based on registration source
    const autoApprove = user.registrationSource === 'whitelist' || user.registrationSource === 'qr_code';
    const newStatus = autoApprove ? 'approved' : 'pending_approval';

    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        accountStatus: newStatus as 'approved' | 'pending_approval',
        isActive: true,
        ...(autoApprove ? { approvedAt: new Date() } : {}),
      })
      .where(eq(users.id, user.id));

    if (autoApprove) {
      // Send welcome email
      await sendEmail(email, 'Witamy w Omena', accountApproved(user.name, 'pl'));
      return redirectToStatus('approved');
    }

    // Send "pending approval" email to user
    await sendEmail(email, 'Email zweryfikowany — Omena', pendingApproval(user.name, 'pl'));

    // Notify admin(s) about new pending user
    const adminList = await db
      .select({ email: admins.email })
      .from(admins)
      .where(and(eq(admins.isActive, true), isNull(admins.deletedAt)))
      .limit(5);

    await Promise.all(
      adminList.map((admin) =>
        sendEmail(admin.email, 'New user awaiting approval — Omena', adminNewUserPending(user.name, email)),
      ),
    );

    return redirectToStatus('pending');
  } catch (error) {
    console.error('[verify-email] Error:', error);
    return redirectToStatus('error');
  }
}

function redirectToStatus(status: string) {
  return NextResponse.redirect(`${getBaseUrl()}/pl/auth/verify-email?status=${status}`);
}
