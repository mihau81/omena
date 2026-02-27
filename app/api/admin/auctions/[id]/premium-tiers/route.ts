import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getTiersForAuction, upsertTiers } from '@/db/queries/premium';
import { getAuctionById } from '@/db/queries';

// ─── Validation schema ───────────────────────────────────────────────────────

const tierSchema = z.object({
  minAmount: z.number().int().min(0),
  maxAmount: z.number().int().positive().nullable(),
  rate: z
    .string()
    .regex(/^\d+\.\d{4}$/, 'Rate must be in format "0.2500"')
    .refine(
      (v) => parseFloat(v) > 0 && parseFloat(v) <= 1,
      'Rate must be between 0 and 1 (exclusive)',
    ),
  sortOrder: z.number().int().min(0).optional(),
});

const putSchema = z.object({
  tiers: z.array(tierSchema).max(20),
});

// ─── GET /api/admin/auctions/[id]/premium-tiers ──────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('auctions:read');
    const { id } = await params;

    const auction = await getAuctionById(id);
    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const tiers = await getTiersForAuction(id);
    return NextResponse.json({ tiers });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Premium tiers GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT /api/admin/auctions/[id]/premium-tiers ───────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('auctions:write');
    const { id } = await params;

    const auction = await getAuctionById(id);
    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { tiers } = parsed.data;

    // Validate tier ranges don't overlap and cover a contiguous range
    if (tiers.length > 0) {
      const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (current.maxAmount === null) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: {
                fieldErrors: {
                  tiers: ['Only the last tier can have an unlimited (null) maxAmount'],
                },
              },
            },
            { status: 400 },
          );
        }
        if (current.maxAmount !== next.minAmount) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: {
                fieldErrors: {
                  tiers: [
                    `Tier gap or overlap: tier ending at ${current.maxAmount} followed by tier starting at ${next.minAmount}`,
                  ],
                },
              },
            },
            { status: 400 },
          );
        }
      }
    }

    const updatedTiers = await upsertTiers(id, tiers);
    return NextResponse.json({ tiers: updatedTiers });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Premium tiers PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
