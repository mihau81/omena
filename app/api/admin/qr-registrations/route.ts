import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { desc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { qrRegistrations } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { z } from 'zod';

const createQrSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  maxUses: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin('users:read');

    const rows = await db
      .select()
      .from(qrRegistrations)
      .orderBy(desc(qrRegistrations.createdAt))
      .limit(200);

    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin('users:write');

    const body = await request.json();
    const parsed = createQrSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const code = crypto.randomBytes(16).toString('hex');

    const [entry] = await db
      .insert(qrRegistrations)
      .values({
        code,
        label: parsed.data.label,
        validFrom: new Date(parsed.data.validFrom),
        validUntil: new Date(parsed.data.validUntil),
        maxUses: parsed.data.maxUses ?? null,
        notes: parsed.data.notes || null,
        createdBy: admin.id,
      })
      .returning();

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[qr-registrations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
