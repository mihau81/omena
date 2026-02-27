import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { notDeleted } from '@/db/helpers';
import { createAdminSchema } from '@/lib/validation/admin';
import { logCreate } from '@/lib/audit';

// ─── GET: List all admin accounts (super_admin only) ────────────────────────

export async function GET(request: NextRequest) {
  try {
    const requestingAdmin = await requireAdmin('admins:manage');

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';

    const baseCondition = notDeleted(admins);
    const whereClause = search
      ? and(
          baseCondition,
          or(
            ilike(admins.name, `%${search}%`),
            ilike(admins.email, `%${search}%`),
          ),
        )
      : baseCondition;

    const rows = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        role: admins.role,
        isActive: admins.isActive,
        totpEnabled: admins.totpEnabled,
        lastLoginAt: admins.lastLoginAt,
        createdAt: admins.createdAt,
        createdBy: admins.createdBy,
      })
      .from(admins)
      .where(whereClause)
      .orderBy(desc(admins.createdAt));

    return NextResponse.json({ admins: rows, total: rows.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('List admins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create new admin account ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const requestingAdmin = await requireAdmin('admins:manage');

    const body = await request.json();
    const parsed = createAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Only super_admin can create other super_admin accounts
    if (parsed.data.role === 'super_admin' && requestingAdmin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super_admin can create super_admin accounts' },
        { status: 403 },
      );
    }

    // Check email uniqueness
    const existing = await db
      .select({ id: admins.id })
      .from(admins)
      .where(and(eq(admins.email, parsed.data.email), notDeleted(admins)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const [newAdmin] = await db
      .insert(admins)
      .values({
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash,
        createdBy: requestingAdmin.id,
      })
      .returning();

    await logCreate('admins', newAdmin.id, {
      email: newAdmin.email,
      name: newAdmin.name,
      role: newAdmin.role,
    }, requestingAdmin.id, 'admin');

    return NextResponse.json(
      {
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          name: newAdmin.name,
          role: newAdmin.role,
          isActive: newAdmin.isActive,
          createdAt: newAdmin.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Create admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
