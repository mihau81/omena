import { NextResponse } from 'next/server';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots, media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { generateCatalogPdf, type CatalogLot, type CatalogAuction } from '@/lib/catalog-pdf';
import { uploadToS3 } from '@/lib/s3';

// ─── POST /api/admin/auctions/[id]/catalog ────────────────────────────────────
// Generate a PDF catalog for the auction, store in S3, save URL on auction row.

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('auctions:write');
    const { id } = await params;

    // Load auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, id), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Load lots with primary image
    const lotRows = await db
      .select({
        lot: lots,
        primaryImageUrl: media.url,
        primaryMediumUrl: media.mediumUrl,
      })
      .from(lots)
      .leftJoin(
        media,
        and(eq(media.lotId, lots.id), eq(media.isPrimary, true), isNull(media.deletedAt)),
      )
      .where(and(eq(lots.auctionId, id), isNull(lots.deletedAt)))
      .orderBy(asc(lots.sortOrder), asc(lots.lotNumber));

    // Build catalog data
    const catalogAuction: CatalogAuction = {
      title: auction.title,
      date: new Intl.DateTimeFormat('pl-PL', {
        day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date(auction.startDate)),
      location: auction.location,
      curator: auction.curator,
      description: auction.description,
    };

    const catalogLots: CatalogLot[] = lotRows.map((row) => ({
      lotNumber: row.lot.lotNumber,
      title: row.lot.title,
      artist: row.lot.artist,
      medium: row.lot.medium,
      dimensions: row.lot.dimensions,
      year: row.lot.year,
      description: row.lot.description,
      estimateMin: row.lot.estimateMin,
      estimateMax: row.lot.estimateMax,
      provenance: (row.lot.provenance as string[]) ?? [],
      // Prefer medium (800px) for better PDF quality without huge file size
      primaryImageUrl: row.primaryMediumUrl ?? row.primaryImageUrl ?? null,
    }));

    // Generate PDF (can take a few seconds for large catalogs)
    const pdfBuffer = await generateCatalogPdf(catalogAuction, catalogLots);

    // Upload to S3
    const key = `catalogs/${id}/catalog-${Date.now()}.pdf`;
    const pdfUrl = await uploadToS3(key, pdfBuffer, 'application/pdf');

    // Persist URL on auction row
    await db
      .update(auctions)
      .set({ catalogPdfUrl: pdfUrl, updatedAt: new Date() })
      .where(eq(auctions.id, id));

    return NextResponse.json({ catalogPdfUrl: pdfUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[catalog] Generation error:', error);
    return NextResponse.json({ error: 'Failed to generate catalog' }, { status: 500 });
  }
}

// ─── GET /api/admin/auctions/[id]/catalog ─────────────────────────────────────
// Return the current catalog URL (if any).

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('auctions:read');
    const { id } = await params;

    const [auction] = await db
      .select({ catalogPdfUrl: auctions.catalogPdfUrl })
      .from(auctions)
      .where(and(eq(auctions.id, id), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    return NextResponse.json({ catalogPdfUrl: auction.catalogPdfUrl ?? null });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
