import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, auctions, media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import {
  generateConditionReportHTML,
  type ConditionReportLot,
  type ConditionReportAuction,
  type ConditionReportMedia,
} from '@/lib/condition-report';

// ─── GET: Return condition report as HTML ───────────────────────────────────
//
//   GET /api/admin/lots/[id]/condition-report
//     → inline HTML (view in browser)
//
//   GET /api/admin/lots/[id]/condition-report?download=true
//     → Content-Disposition: attachment (triggers browser download)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { id } = await params;

    // Fetch lot
    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    // Fetch parent auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, lot.auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Fetch primary media (image only)
    const [primaryMedia] = await db
      .select()
      .from(media)
      .where(
        and(
          eq(media.lotId, id),
          eq(media.isPrimary, true),
          eq(media.mediaType, 'image'),
          isNull(media.deletedAt),
        ),
      )
      .limit(1);

    // Build typed objects for the template
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

    const reportAuction: ConditionReportAuction = {
      id: auction.id,
      title: auction.title,
      startDate: auction.startDate,
    };

    const reportMedia: ConditionReportMedia | null = primaryMedia
      ? {
          url: primaryMedia.url,
          largeUrl: primaryMedia.largeUrl,
          mediumUrl: primaryMedia.mediumUrl,
          altText: primaryMedia.altText,
        }
      : null;

    const html = generateConditionReportHTML(reportLot, reportAuction, reportMedia);

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === 'true';

    const filename = `lot-${lot.lotNumber}-condition-report.html`;
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
    console.error('Condition report GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
