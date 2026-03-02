import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { qrRegistrations } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('users:write');
    const { id } = await params;

    const result = await db
      .update(qrRegistrations)
      .set({ isActive: false })
      .where(eq(qrRegistrations.id, id))
      .returning({ id: qrRegistrations.id });

    if (result.length === 0) {
      return NextResponse.json({ error: 'QR registration not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'QR registration deactivated' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
