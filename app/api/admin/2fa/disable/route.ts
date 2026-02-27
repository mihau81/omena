import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { verifyTOTP, decryptSecret } from '@/lib/totp';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/admin/2fa/disable
// Body: { token: string }
// Verifies the current TOTP code then clears totpSecret and sets totpEnabled = false.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const adminId = user.id;

    const body = await req.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Invalid TOTP format. Expected 6 digits.' },
        { status: 400 }
      );
    }

    // Fetch current admin record
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, adminId))
      .limit(1);

    if (!admin || !admin.totpSecret || !admin.totpEnabled) {
      return NextResponse.json({ error: 'TOTP is not enabled on this account.' }, { status: 400 });
    }

    // Verify TOTP code before disabling
    const decryptedSecret = decryptSecret(admin.totpSecret);
    const isValid = verifyTOTP(decryptedSecret, token);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid TOTP code.' }, { status: 401 });
    }

    // Disable 2FA and clear stored secret
    await db
      .update(admins)
      .set({
        totpEnabled: false,
        totpSecret: null,
      })
      .where(eq(admins.id, adminId));

    return NextResponse.json({ message: '2FA disabled successfully.' }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('2FA disable error:', error);
    return NextResponse.json({ error: 'Failed to disable 2FA.' }, { status: 500 });
  }
}
