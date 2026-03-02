import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { passwordResetConfirmSchema } from '@/lib/validation/user';
import { consumeToken } from '@/lib/token-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = passwordResetConfirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { token, newPassword } = parsed.data;

    // Atomically consume the token
    const consumed = await consumeToken(token, 'password_reset');
    if (!consumed) {
      return NextResponse.json({ error: 'Invalid, expired, or already used reset link' }, { status: 400 });
    }

    const email = consumed.identifier;

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('[password-reset/confirm] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
