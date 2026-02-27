import { NextResponse } from 'next/server';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, auctions, media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import {
  generateBatchConditionReportHTML,
  type ConditionReportLot,
  type ConditionReportAuction,
  type ConditionReportMedia,
  type BatchConditionReportItem,
} from '@/lib/condition-report';

// ─── GET: Combined HTML with all lot condition reports in an auction ─────────
//
//   GET /api/admin/auctions/[auctionId]/condition-reports
//     → inline HTML (one page per lot, CSS page-break-before: always)
//
//   GET /api/admin/auctions/[auctionId]/condition-reports?download=true
//     → Content-Disposition: attachment

export async function GET(
  request: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { auctionId } = await params;

    // Fetch auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Fetch all lots for this auction, ordered by sortOrder then lotNumber
    const auctionLots = await db
      .select()
      .from(lots)
      .where(and(eq(lots.auctionId, auctionId), isNull(lots.deletedAt)))
      .orderBy(asc(lots.sortOrder), asc(lots.lotNumber));

    // Fetch all primary images for lots in this auction in one query
    const lotIds = auctionLots.map((l) => l.id);

    let primaryMediaMap = new Map<string, ConditionReportMedia>();

    if (lotIds.length > 0) {
      // Query primary images for all lots at once
      const primaryImages = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.isPrimary, true),
            eq(media.mediaType, 'image'),
            isNull(media.deletedAt),
            eq(media.auctionId, auctionId),
          ),
        );

      // Also fetch by lotId membership — drizzle doesn't have inArray sugar for uuid[]
      // so we query per-lot only when count is manageable, otherwise fall back to scanning
      // all primary images for these lots individually
      const perLotImages = await Promise.all(
        lotIds.map(async (lotId) => {
          const [img] = await db
            .select()
            .from(media)
            .where(
              and(
                eq(media.lotId, lotId),
                eq(media.isPrimary, true),
                eq(media.mediaType, 'image'),
                isNull(media.deletedAt),
              ),
            )
            .limit(1);
          return { lotId, img: img ?? null };
        }),
      );

      // Suppress unused variable warning from the auctionId-scoped query above
      void primaryImages;

      for (const { lotId, img } of perLotImages) {
        if (img) {
          primaryMediaMap.set(lotId, {
            url: img.url,
            largeUrl: img.largeUrl,
            mediumUrl: img.mediumUrl,
            altText: img.altText,
          });
        }
      }
    }

    // Build report auction object
    const reportAuction: ConditionReportAuction = {
      id: auction.id,
      title: auction.title,
      startDate: auction.startDate,
    };

    // Build items array
    const items: BatchConditionReportItem[] = auctionLots.map((lot) => {
      const reportLot: ConditionReportLot = {
        id: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        artist: lot.artist,
        medium: lot.medium,
        dimensions: lot.dimensions,
        year: lot.year,
        estimateMin: lot.estimateMin,
        estimateMax: lot.estimateMax,
        conditionNotes: lot.conditionNotes,
        provenance: lot.provenance,
        description: lot.description,
      };
      const primaryMedia: ConditionReportMedia | null = primaryMediaMap.get(lot.id) ?? null;
      return { lot: reportLot, primaryMedia };
    });

    const html = generateBatchConditionReportHTML(reportAuction, items);

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === 'true';

    const slug = auction.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `${slug}-condition-reports.html`;
    const disposition = isDownload
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': disposition,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Batch condition reports GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
