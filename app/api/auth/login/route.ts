import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/lib/auth';
import { loginSchema } from '@/lib/validation/user';
import { AuthError } from 'next-auth';
import { authLimiter } from '@/lib/rate-limiters';

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = authLimiter.check(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }

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
