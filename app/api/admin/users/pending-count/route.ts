import { NextResponse } from 'next/server';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { notDeleted } from '@/db/helpers';
import { requireAdmin, AuthError } from '@/lib/auth-utils';

export async function GET() {
  try {
    await requireAdmin('users:read');

    const [result] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.accountStatus, 'pending_approval'), notDeleted(users)));

    return NextResponse.json({ count: result.total });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
