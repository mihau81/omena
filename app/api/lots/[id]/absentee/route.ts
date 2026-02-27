import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import {
  placeAbsenteeBid,
  getUserAbsenteeBid,
  cancelAbsenteeBid,
  AbsenteeError,
} from '@/lib/absentee-service';

const absenteeSchema = z.object({
  maxAmount: z.number().int().positive('Maximum bid must be a positive integer'),
});

// ─── POST: Set (create/update) an absentee bid ───────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lotId } = await params;

    const user = await requireAuth();
    if (user.userType !== 'user') {
      return NextResponse.json(
        { error: 'Only registered users can place absentee bids' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = absenteeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await placeAbsenteeBid(lotId, user.id, parsed.data.maxAmount);

    return NextResponse.json(
      { message: 'Absentee bid set successfully', id: result.id },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AbsenteeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Absentee bid POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: Check if user has an active absentee bid (returns boolean only) ────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lotId } = await params;

    const user = await requireAuth();
    if (user.userType !== 'user') {
      return NextResponse.json({ hasAbsenteeBid: false });
    }

    const result = await getUserAbsenteeBid(lotId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Absentee bid GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Cancel an active absentee bid ───────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lotId } = await params;

    const user = await requireAuth();
    if (user.userType !== 'user') {
      return NextResponse.json(
        { error: 'Only registered users can cancel absentee bids' },
        { status: 403 },
      );
    }

    await cancelAbsenteeBid(lotId, user.id);

    return NextResponse.json({ message: 'Absentee bid cancelled' });
  } catch (error) {
    if (error instanceof AbsenteeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Absentee bid DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
