import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { userWhitelists } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { z } from 'zod';

const addWhitelistSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin('users:read');

    const rows = await db
      .select()
      .from(userWhitelists)
      .orderBy(desc(userWhitelists.createdAt))
      .limit(500);

    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin('users:write');

    const body = await request.json();
    const parsed = addWhitelistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const [entry] = await db
      .insert(userWhitelists)
      .values({
        email: parsed.data.email,
        name: parsed.data.name || null,
        notes: parsed.data.notes || null,
        importedBy: admin.id,
      })
      .onConflictDoNothing({ target: userWhitelists.email })
      .returning();

    if (!entry) {
      return NextResponse.json({ error: 'Email already on whitelist' }, { status: 409 });
    }

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
