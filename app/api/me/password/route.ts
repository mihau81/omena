import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { requireApprovedUser, AuthError } from '@/lib/auth-utils';
import { changePasswordSchema } from '@/lib/validation/user';

// ─── POST /api/me/password ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const sessionUser = await requireApprovedUser();
    const body = await request.json();

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // Fetch current password hash
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user has a password, verify the current one
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    // Hash and set new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, sessionUser.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/password] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
