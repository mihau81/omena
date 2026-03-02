import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { requireApprovedUser, AuthError } from '@/lib/auth-utils';

// ─── GET /api/me/profile ────────────────────────────────────────────────────

export async function GET() {
  try {
    const sessionUser = await requireApprovedUser();

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        address: users.address,
        city: users.city,
        postalCode: users.postalCode,
        country: users.country,
        hasPassword: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? '',
        address: user.address ?? '',
        city: user.city ?? '',
        postalCode: user.postalCode ?? '',
        country: user.country ?? '',
        hasPassword: !!user.hasPassword,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/profile] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/me/profile ──────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireApprovedUser();
    const body = await request.json();

    const allowedFields = ['name', 'phone', 'address', 'city', 'postalCode', 'country'] as const;
    const updates: Record<string, string> = {};

    for (const field of allowedFields) {
      if (field in body && typeof body[field] === 'string') {
        updates[field] = body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if ('name' in updates && updates.name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }

    await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, sessionUser.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/profile] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
