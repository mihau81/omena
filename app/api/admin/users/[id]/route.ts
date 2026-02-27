import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getUserDetail, getUserBidsPaginated, getUserRegistrationsPaginated, getUserWatchedLotsPaginated } from '@/db/queries/users';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { updateUserSchema } from '@/lib/validation/user';
import { logUpdate, logDelete } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: Full user detail ──────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('users:read');
    const { id } = await params;

    const user = await getUserDetail(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for sub-resource queries
    const { searchParams } = request.nextUrl;
    const include = searchParams.get('include');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    let bidsData = null;
    let registrationsData = null;
    let watchedData = null;

    if (include === 'bids') {
      bidsData = await getUserBidsPaginated(id, page, limit);
    } else if (include === 'registrations') {
      registrationsData = await getUserRegistrationsPaginated(id, page, limit);
    } else if (include === 'watched') {
      watchedData = await getUserWatchedLotsPaginated(id, page, limit);
    }

    return NextResponse.json({
      user,
      ...(bidsData && { bids: bidsData }),
      ...(registrationsData && { registrations: registrationsData }),
      ...(watchedData && { watched: watchedData }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Get user detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update user fields ──────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('users:write');
    const { id } = await params;

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      );
    }

    // Fetch existing user
    const existing = await getUserDetail(id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check visibility change — requires extra permission
    if (parsed.data.visibilityLevel && parsed.data.visibilityLevel !== existing.visibilityLevel) {
      try {
        await requireAdmin('users:visibility');
      } catch {
        return NextResponse.json(
          { error: 'Missing permission: users:visibility' },
          { status: 403 },
        );
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Audit log
    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};
    for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
      oldData[key] = existing[key as keyof typeof existing];
      newData[key] = parsed.data[key];
    }
    await logUpdate('users', id, oldData, newData, admin.id, 'admin');

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete user ───────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('users:write');
    const { id } = await params;

    const existing = await getUserDetail(id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    await logDelete('users', id, {
      email: existing.email,
      name: existing.name,
    }, admin.id, 'admin');

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
