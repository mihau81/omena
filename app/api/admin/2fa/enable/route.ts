import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { verifyTOTP, encryptSecret, generateRecoveryCodes } from '@/lib/totp';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/admin/2fa/enable
// Body: { secret: string, token: string }
// Verifies the TOTP token against the provided secret, then persists the
// encrypted secret and sets totpEnabled = true.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const adminId = user.id;

    const body = await req.json();
    const { secret, token } = body as { secret?: string; token?: string };

    if (!secret || typeof secret !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid secret.' }, { status: 400 });
    }

    if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Invalid TOTP format. Expected 6 digits.' },
        { status: 400 }
      );
    }

    // Verify the TOTP token against the provided (plain-text) secret
    const isValid = verifyTOTP(secret, token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid TOTP code.' }, { status: 401 });
    }

    // Encrypt the secret and persist it, enabling 2FA
    const encryptedSecret = encryptSecret(secret);
    await db
      .update(admins)
      .set({
        totpSecret: encryptedSecret,
        totpEnabled: true,
      })
      .where(eq(admins.id, adminId));

    const recoveryCodes = generateRecoveryCodes();

    return NextResponse.json({ message: '2FA enabled successfully.', recoveryCodes }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('2FA enable error:', error);
    return NextResponse.json({ error: 'Failed to enable 2FA.' }, { status: 500 });
  }
}
