import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { users } from '@/db/schema';
import { registerUserSchema } from '@/lib/validation/user';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, name, password } = parsed.data;

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
      })
      .returning({ id: users.id, email: users.email });

    return NextResponse.json(
      { message: 'Account created successfully', userId: newUser.id },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
