import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from '@/db/connection';
import { qrRegistrations } from '@/db/schema';
import { requireAdmin } from '@/lib/auth-utils';
import { getBaseUrl } from '@/lib/token-service';
import { handleApiError } from '@/lib/api-response';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('users:read');
    const { id } = await params;

    const [qr] = await db
      .select({ code: qrRegistrations.code, label: qrRegistrations.label })
      .from(qrRegistrations)
      .where(eq(qrRegistrations.id, id))
      .limit(1);

    if (!qr) {
      return NextResponse.json({ error: 'QR registration not found' }, { status: 404 });
    }

    const registerUrl = `${getBaseUrl()}/en/register?qr=${qr.code}`;

    const pngBuffer = await QRCode.toBuffer(registerUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#f8f6f3' },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="qr-${qr.label.replace(/\s+/g, '-')}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return handleApiError(error, 'qr-image');
  }
}
