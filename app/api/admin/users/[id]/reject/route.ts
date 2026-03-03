import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { rejectUserSchema } from '@/lib/validation/user';
import { sendEmail } from '@/lib/email';
import { accountRejected } from '@/lib/email-templates';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('users:write');
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = rejectUserSchema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.accountStatus === 'rejected') {
      return NextResponse.json({ error: 'User is already rejected' }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        accountStatus: 'rejected',
        rejectedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // Send email
    await sendEmail(user.email, 'Wniosek o konto — Omena', accountRejected(user.name, reason, 'pl'));

    return NextResponse.json({ message: 'User rejected' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[admin/users/reject] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
