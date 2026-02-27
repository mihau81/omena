import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { changePasswordSchema } from '@/lib/validation/admin';
import { logUpdate } from '@/lib/audit';

const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

// ─── GET: Current admin profile ──────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    const currentAdmin = await requireAdmin();

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
      })
      .from(admins)
      .where(eq(admins.id, currentAdmin.id))
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

// ─── PATCH: Update own profile or change password ───────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const currentAdmin = await requireAdmin();
    const body = await request.json();

    // Detect password change request by presence of 'currentPassword'
    if ('currentPassword' in body) {
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const [admin] = await db
        .select({ id: admins.id, passwordHash: admins.passwordHash })
        .from(admins)
        .where(eq(admins.id, currentAdmin.id))
        .limit(1);

      if (!admin) {
        return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
      }

      const valid = await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await db
        .update(admins)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(admins.id, currentAdmin.id));

      await logUpdate(
        'admins',
        currentAdmin.id,
        { password: '[redacted]' },
        { password: '[changed]' },
        currentAdmin.id,
        'admin',
      );

      return NextResponse.json({ success: true });
    }

    // Profile name update
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (!parsed.data.name) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [existing] = await db
      .select({ name: admins.name })
      .from(admins)
      .where(eq(admins.id, currentAdmin.id))
      .limit(1);

    const [updated] = await db
      .update(admins)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(admins.id, currentAdmin.id))
      .returning({ id: admins.id, name: admins.name, email: admins.email });

    await logUpdate(
      'admins',
      currentAdmin.id,
      { name: existing?.name },
      { name: parsed.data.name },
      currentAdmin.id,
      'admin',
    );

    return NextResponse.json({ admin: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
