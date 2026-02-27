import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { listUsers } from '@/db/queries/users';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { notDeleted } from '@/db/helpers';
import { createUserSchema } from '@/lib/validation/user';
import { logCreate } from '@/lib/audit';

// ─── GET: List users with pagination, search, filters ───────────────────────

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin('users:read');

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || undefined;
    const visibilityLevel = searchParams.get('visibilityLevel') as '0' | '1' | '2' | null;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const result = await listUsers({
      search,
      visibilityLevel: visibilityLevel || undefined,
      isActive,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create new user ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin('users:write');

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Check email uniqueness
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, parsed.data.email), notDeleted(users)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      );
    }

    // Generate a random password (admin-created users get a temp password)
    const tempPassword = crypto.randomUUID().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        ...parsed.data,
        passwordHash,
      })
      .returning();

    // Audit log
    await logCreate('users', newUser.id, {
      email: newUser.email,
      name: newUser.name,
      visibilityLevel: newUser.visibilityLevel,
    }, admin.id, 'admin');

    return NextResponse.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          visibilityLevel: newUser.visibilityLevel,
          createdAt: newUser.createdAt,
        },
        tempPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
