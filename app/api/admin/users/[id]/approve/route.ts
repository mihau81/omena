import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { sendEmail } from '@/lib/email';
import { accountApproved } from '@/lib/email-templates';
import { createNotification } from '@/lib/notifications';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('users:write');
    const { id } = await params;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.accountStatus === 'approved') {
      return NextResponse.json({ error: 'User is already approved' }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        accountStatus: 'approved',
        isActive: true,
        approvedBy: admin.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // Notify user
    await createNotification(
      id,
      'registration_approved',
      'Konto zatwierdzone',
      'Twoje konto Omena zostało zatwierdzone. Możesz się teraz zalogować i brać udział w aukcjach.',
    );

    // Send email
    await sendEmail(user.email, 'Konto zatwierdzone — Omena', accountApproved(user.name, 'pl'));

    return NextResponse.json({ message: 'User approved successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[admin/users/approve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
