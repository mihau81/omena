import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/connection';
import { pageViews } from '@/db/schema';

const INTERNAL_SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(request: NextRequest) {
  // Only accept internal calls
  const secret = request.headers.get('x-internal-secret');
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    await db.insert(pageViews).values({
      userId: body.userId || null,
      userType: body.userType || 'anonymous',
      path: body.path,
      ipAddress: body.ipAddress || null,
      userAgent: body.userAgent || null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Page view log error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
