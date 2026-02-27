import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { notDeleted } from '@/db/helpers';
import { updateAdminSchema } from '@/lib/validation/admin';
import { logUpdate, logDelete } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: Single admin detail ────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin('admins:manage');
    const { id } = await params;

    const [admin] = await db
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
      .where(and(eq(admins.id, id), notDeleted(admins)))
      .limit(1);

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({ admin });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update admin (name, role, isActive, password) ───────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const requestingAdmin = await requireAdmin('admins:manage');
    const { id } = await params;

    const body = await request.json();
    const parsed = updateAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(admins)
      .where(and(eq(admins.id, id), notDeleted(admins)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Prevent self-deactivation
    if (id === requestingAdmin.id && parsed.data.isActive === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 },
      );
    }

    // Only super_admin can modify super_admin accounts or assign super_admin role
    if (
      (parsed.data.role === 'super_admin' || existing.role === 'super_admin') &&
      requestingAdmin.role !== 'super_admin'
    ) {
      return NextResponse.json(
        { error: 'Only super_admin can modify super_admin accounts' },
        { status: 403 },
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.password) {
      updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    const [updated] = await db
      .update(admins)
      .set(updateData)
      .where(eq(admins.id, id))
      .returning();

    // Audit log (exclude password hash)
    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};
    for (const key of ['name', 'role', 'isActive'] as const) {
      if (parsed.data[key] !== undefined) {
        oldData[key] = existing[key];
        newData[key] = parsed.data[key];
      }
    }
    if (parsed.data.password) {
      oldData['password'] = '[redacted]';
      newData['password'] = '[changed]';
    }
    await logUpdate('admins', id, oldData, newData, requestingAdmin.id, 'admin');

    return NextResponse.json({
      admin: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
        lastLoginAt: updated.lastLoginAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Update admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete admin account ──────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const requestingAdmin = await requireAdmin('admins:manage');
    const { id } = await params;

    // Prevent self-deletion
    if (id === requestingAdmin.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(admins)
      .where(and(eq(admins.id, id), notDeleted(admins)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Only super_admin can delete super_admin accounts
    if (existing.role === 'super_admin' && requestingAdmin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super_admin can delete super_admin accounts' },
        { status: 403 },
      );
    }

    await db
      .update(admins)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(admins.id, id));

    await logDelete('admins', id, {
      email: existing.email,
      name: existing.name,
      role: existing.role,
    }, requestingAdmin.id, 'admin');

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Delete admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
