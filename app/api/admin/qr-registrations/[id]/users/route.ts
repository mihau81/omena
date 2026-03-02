import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { requireAdmin } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/api-response';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('users:read');
    const { id } = await params;

    const registeredUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        accountStatus: users.accountStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.qrRegistrationId, id))
      .orderBy(users.createdAt);

    return NextResponse.json({ users: registeredUsers });
  } catch (error) {
    return handleApiError(error, 'qr-registrations/users');
  }
}
