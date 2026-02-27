/**
 * Maps database rows to frontend types used by existing components.
 * This keeps components working identically while data now comes from the DB.
 */

import type { Auction, Lot } from '@/app/lib/types';

// DB auction status → frontend status
function mapAuctionStatus(
  dbStatus: string,
  startDate: Date,
  endDate: Date,
): Auction['status'] {
  // 'live' maps directly
  if (dbStatus === 'live') return 'live';
  // 'archive' or 'reconciliation' → ended
  if (dbStatus === 'archive' || dbStatus === 'reconciliation') return 'ended';
  // 'draft' or 'preview' → upcoming
  return 'upcoming';
}

/**
 * Maps a DB auction row (from getAuctions / getAuctionBySlug) to the Auction
 * interface used by all existing components.
 */
export function mapDBAuctionToFrontend(
  row: {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    startDate: Date;
    endDate: Date;
    location: string;
    curator: string;
    status: string;
    coverImageId: string | null;
    [key: string]: unknown;
  },
  opts?: { lotCount?: number; coverImageUrl?: string },
): Auction {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    status: mapAuctionStatus(row.status, row.startDate, row.endDate),
    category: (row.category as Auction['category']) || 'mixed',
    coverImage: opts?.coverImageUrl || '/omena/images/auctions/lot-1.jpg',
    totalLots: opts?.lotCount ?? 0,
    location: row.location,
    curator: row.curator,
  };
}

/**
 * Maps a DB lot row (from getLotsByAuction / getLotById) to the Lot
 * interface used by existing components.
 */
export function mapDBLotToFrontend(
  row: {
    id: string;
    title: string;
    artist: string;
    description: string;
    medium: string;
    dimensions: string;
    year: number | null;
    estimateMin: number;
    estimateMax: number;
    lotNumber: number;
    hammerPrice: number | null;
    provenance: unknown;
    exhibitions: unknown;
    [key: string]: unknown;
  },
  opts: {
    auctionSlug: string;
    images: string[];
    currentBid?: number | null;
  },
): Lot {
  return {
    id: row.id,
    auctionSlug: opts.auctionSlug,
    title: row.title,
    artist: row.artist,
    description: row.description,
    medium: row.medium,
    dimensions: row.dimensions,
    year: row.year ?? 0,
    estimateMin: row.estimateMin,
    estimateMax: row.estimateMax,
    currentBid: opts.currentBid ?? row.hammerPrice ?? null,
    images: opts.images.length > 0 ? opts.images : ['/omena/images/auctions/lot-1.jpg'],
    provenance: Array.isArray(row.provenance) ? row.provenance as string[] : [],
    exhibited: Array.isArray(row.exhibitions) ? row.exhibitions as string[] : [],
    lotNumber: row.lotNumber,
  };
}
