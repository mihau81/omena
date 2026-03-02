import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { startLotTimer, extendLotTimer, stopLotTimer } from '@/lib/lot-timer';

// ─── POST: Timer actions (start | extend | stop) ─────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:write');
    const { id: lotId } = await params;

    // Verify lot exists
    const [lot] = await db
      .select({ id: lots.id, status: lots.status, closingAt: lots.closingAt })
      .from(lots)
      .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const body = await request.json() as { action: string; durationSeconds?: number; extensionSeconds?: number };
    const { action } = body;

    if (action === 'start') {
      const duration = body.durationSeconds ?? 120;
      if (typeof duration !== 'number' || duration < 10 || duration > 3600) {
        return NextResponse.json({ error: 'durationSeconds must be between 10 and 3600' }, { status: 400 });
      }
      const closingAt = await startLotTimer(lotId, duration);
      return NextResponse.json({ closingAt: closingAt.toISOString(), durationSeconds: duration });
    }

    if (action === 'extend') {
      const extension = body.extensionSeconds ?? 30;
      const newClosingAt = await extendLotTimer(lotId, extension);
      if (!newClosingAt) {
        return NextResponse.json({ error: 'No active timer to extend' }, { status: 400 });
      }
      return NextResponse.json({ newClosingAt: newClosingAt.toISOString() });
    }

    if (action === 'stop') {
      await stopLotTimer(lotId);
      return NextResponse.json({ stopped: true });
    }

    return NextResponse.json({ error: 'Unknown action. Use: start | extend | stop' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Timer route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: Current timer state ─────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { id: lotId } = await params;

    const [lot] = await db
      .select({ closingAt: lots.closingAt, timerDuration: lots.timerDuration, status: lots.status })
      .from(lots)
      .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    return NextResponse.json({
      closingAt: lot.closingAt?.toISOString() ?? null,
      timerDuration: lot.timerDuration,
      status: lot.status,
      secondsRemaining: lot.closingAt
        ? Math.max(0, Math.floor((lot.closingAt.getTime() - Date.now()) / 1000))
        : null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
