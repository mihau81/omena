import { describe, it, expect } from 'vitest';
import { mapDBAuctionToFrontend, mapDBLotToFrontend } from '@/lib/mappers';

const baseAuctionRow = {
  id: 'auction-1',
  slug: 'test-auction-2026',
  title: 'Test Auction',
  description: 'A test auction',
  category: 'mixed',
  startDate: new Date('2026-03-01T10:00:00Z'),
  endDate: new Date('2026-03-01T14:00:00Z'),
  location: 'Warsaw',
  curator: 'Jan Nowak',
  status: 'draft',
  coverImageId: null,
};

const baseLotRow = {
  id: 'lot-1',
  title: 'Sunset Painting',
  artist: 'Jan Nowak',
  description: 'Oil on canvas',
  medium: 'Oil on canvas',
  dimensions: '50 x 70 cm',
  year: 2020,
  estimateMin: 5000,
  estimateMax: 8000,
  lotNumber: 1,
  hammerPrice: null,
  provenance: ['Gallery A', 'Private collection'],
  exhibitions: ['Warsaw 2023'],
  status: 'catalogued',
};

describe('mapDBAuctionToFrontend', () => {
  describe('field mapping', () => {
    it('maps id', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.id).toBe('auction-1');
    });

    it('maps slug', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.slug).toBe('test-auction-2026');
    });

    it('maps title', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.title).toBe('Test Auction');
    });

    it('maps description', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.description).toBe('A test auction');
    });

    it('maps startDate to date ISO string', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.date).toBe('2026-03-01T10:00:00.000Z');
    });

    it('maps endDate to endDate ISO string', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.endDate).toBe('2026-03-01T14:00:00.000Z');
    });

    it('maps location', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.location).toBe('Warsaw');
    });

    it('maps curator', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.curator).toBe('Jan Nowak');
    });

    it('maps category', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.category).toBe('mixed');
    });
  });

  describe('status mapping', () => {
    it('maps "live" status to "live"', () => {
      const result = mapDBAuctionToFrontend({ ...baseAuctionRow, status: 'live' });
      expect(result.status).toBe('live');
    });

    it('maps "archive" status to "ended"', () => {
      const result = mapDBAuctionToFrontend({ ...baseAuctionRow, status: 'archive' });
      expect(result.status).toBe('ended');
    });

    it('maps "reconciliation" status to "ended"', () => {
      const result = mapDBAuctionToFrontend({ ...baseAuctionRow, status: 'reconciliation' });
      expect(result.status).toBe('ended');
    });

    it('maps "draft" status to "upcoming"', () => {
      const result = mapDBAuctionToFrontend({ ...baseAuctionRow, status: 'draft' });
      expect(result.status).toBe('upcoming');
    });

    it('maps "preview" status to "upcoming"', () => {
      const result = mapDBAuctionToFrontend({ ...baseAuctionRow, status: 'preview' });
      expect(result.status).toBe('upcoming');
    });
  });

  describe('opts', () => {
    it('uses lotCount from opts', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow, { lotCount: 42 });
      expect(result.totalLots).toBe(42);
    });

    it('defaults totalLots to 0', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.totalLots).toBe(0);
    });

    it('uses coverImageUrl from opts', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow, { coverImageUrl: 'https://example.com/img.jpg' });
      expect(result.coverImage).toBe('https://example.com/img.jpg');
    });

    it('falls back to default cover image when no coverImageUrl', () => {
      const result = mapDBAuctionToFrontend(baseAuctionRow);
      expect(result.coverImage).toBeTruthy();
    });
  });
});

describe('mapDBLotToFrontend', () => {
  const opts = {
    auctionSlug: 'test-auction-2026',
    images: ['https://example.com/img1.jpg'],
  };

  describe('field mapping', () => {
    it('maps id', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.id).toBe('lot-1');
    });

    it('maps title', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.title).toBe('Sunset Painting');
    });

    it('maps artist', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.artist).toBe('Jan Nowak');
    });

    it('maps lotNumber', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.lotNumber).toBe(1);
    });

    it('maps estimateMin and estimateMax', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.estimateMin).toBe(5000);
      expect(result.estimateMax).toBe(8000);
    });

    it('maps auctionSlug from opts', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.auctionSlug).toBe('test-auction-2026');
    });

    it('maps images from opts', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.images).toEqual(['https://example.com/img1.jpg']);
    });

    it('falls back to default image when opts.images is empty', () => {
      const result = mapDBLotToFrontend(baseLotRow, { ...opts, images: [] });
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeTruthy();
    });

    it('maps year with 0 fallback for null', () => {
      const result = mapDBLotToFrontend({ ...baseLotRow, year: null }, opts);
      expect(result.year).toBe(0);
    });

    it('maps provenance array', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.provenance).toEqual(['Gallery A', 'Private collection']);
    });

    it('maps exhibitions as exhibited array', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.exhibited).toEqual(['Warsaw 2023']);
    });

    it('uses empty array for non-array provenance', () => {
      const result = mapDBLotToFrontend({ ...baseLotRow, provenance: null }, opts);
      expect(result.provenance).toEqual([]);
    });
  });

  describe('currentBid', () => {
    it('uses opts.currentBid when provided', () => {
      const result = mapDBLotToFrontend(baseLotRow, { ...opts, currentBid: 6000 });
      expect(result.currentBid).toBe(6000);
    });

    it('falls back to hammerPrice when no currentBid', () => {
      const result = mapDBLotToFrontend(
        { ...baseLotRow, hammerPrice: 7500 },
        opts,
      );
      expect(result.currentBid).toBe(7500);
    });

    it('returns null when no currentBid and no hammerPrice', () => {
      const result = mapDBLotToFrontend(baseLotRow, opts);
      expect(result.currentBid).toBeNull();
    });
  });
});
