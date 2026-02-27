import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchLots } from '@/db/queries';

const searchParamsSchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters').max(200),
  auction: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = searchParamsSchema.safeParse({
      q: searchParams.get('q'),
      auction: searchParams.get('auction'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { q, auction, page, limit } = parsed.data;

    // For now, treat all API users as public visibility level (0)
    const userVisibility = 0;

    const result = await searchLots({
      query: q,
      userVisibility,
      auctionId: auction,
      page,
      limit,
    });

    return NextResponse.json({
      data: result.lots.map((lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        artist: lot.artist,
        estimateMin: lot.estimateMin,
        estimateMax: lot.estimateMax,
        auctionSlug: lot.auctionSlug,
        auctionTitle: lot.auctionTitle,
        primaryImageUrl: lot.primaryImageUrl,
        primaryThumbnailUrl: lot.primaryThumbnailUrl,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
