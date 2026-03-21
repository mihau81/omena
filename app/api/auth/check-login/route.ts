import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authLimiter } from '@/lib/rate-limiters';
import { getClientIp } from '@/lib/with-rate-limit';

const checkLoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = authLimiter.check(ip);
    if (!rl.success) {
      return NextResponse.json(
        { requiresTOTP: false },
        { status: 200 },
      );
    }

    const body = await req.json();
    const parsed = checkLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ requiresTOTP: false });
    }

    const { email, password } = parsed.data;

    const [admin] = await db
      .select({ passwordHash: admins.passwordHash, isActive: admins.isActive, totpEnabled: admins.totpEnabled, totpSecret: admins.totpSecret })
      .from(admins)
      .where(and(eq(admins.email, email), isNull(admins.deletedAt)))
      .limit(1);

    if (admin && admin.isActive && admin.totpEnabled && admin.totpSecret) {
      const passwordValid = await bcrypt.compare(password, admin.passwordHash);
      if (passwordValid) {
        return NextResponse.json({ requiresTOTP: true });
      }
    }

    // Don't leak info — always return false for non-admin or invalid credentials
    return NextResponse.json({ requiresTOTP: false });
  } catch (error) {
    console.error('[check-login] Error:', error);
    return NextResponse.json({ requiresTOTP: false });
  }
}
