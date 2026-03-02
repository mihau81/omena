import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { searchLots } from '@/db/queries';
import type { LotCategory } from '@/db/queries';

const LOT_CATEGORIES = ['malarstwo', 'rzezba', 'grafika', 'fotografia', 'rzemiosto', 'design', 'bizuteria', 'inne'] as const;

const searchParamsSchema = z.object({
  q: z.string().max(200).default(''),
  auction: z.string().optional(),
  categories: z.string().optional(),
  estimateMin: z.coerce.number().int().min(0).optional(),
  estimateMax: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['lot_number', 'estimate_asc', 'estimate_desc', 'relevance']).default('lot_number'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = searchParamsSchema.safeParse({
      q: searchParams.get('q') ?? '',
      auction: searchParams.get('auction'),
      categories: searchParams.get('categories'),
      estimateMin: searchParams.get('estimateMin'),
      estimateMax: searchParams.get('estimateMax'),
      sortBy: searchParams.get('sortBy'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { q, auction, categories: categoriesStr, estimateMin, estimateMax, sortBy, page, limit } = parsed.data;

    const categories = categoriesStr
      ? categoriesStr.split(',').filter((c): c is LotCategory => (LOT_CATEGORIES as readonly string[]).includes(c))
      : undefined;

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const userVisibility = token?.visibilityLevel ?? 0;

    const result = await searchLots({
      query: q,
      userVisibility,
      auctionId: auction,
      categories,
      estimateMin,
      estimateMax,
      sortBy,
      page,
      limit,
    });

    return NextResponse.json({
      data: result.lots.map((lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        artist: lot.artist,
        category: lot.category,
        estimateMin: lot.estimateMin,
        estimateMax: lot.estimateMax,
        status: lot.status,
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
