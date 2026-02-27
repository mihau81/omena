import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { generateTOTPSecret, generateQRCodeDataURL } from '@/lib/totp';

// POST /api/admin/2fa/setup
// Generates a new TOTP secret and QR code — does NOT save to DB yet.
// The client must call /api/admin/2fa/enable with the secret + a valid token to activate.
export async function POST(_req: NextRequest) {
  try {
    const user = await requireAdmin();

    const { secret, uri } = generateTOTPSecret(user.email);
    const qrCodeDataURL = await generateQRCodeDataURL(uri);

    return NextResponse.json(
      {
        secret,
        qrCodeDataURL,
        message: 'Scan the QR code with your authenticator app, then verify a code to enable 2FA.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('2FA setup error:', error);
    return NextResponse.json({ error: 'Failed to initiate 2FA setup' }, { status: 500 });
  }
}
