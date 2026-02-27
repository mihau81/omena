import { NextResponse } from 'next/server';
import { signIn } from '@/lib/auth';
import { loginSchema } from '@/lib/validation/user';
import { AuthError } from 'next-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    await signIn('user-credentials', {
      email,
      password,
      redirect: false,
    });

    return NextResponse.json({ message: 'Login successful' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }
    throw error;
  }
}
