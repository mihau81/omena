/**
 * Unit tests for GET /api/user/bids
 * Coverage target: user bids route with lot/auction details and images
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockAuth = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockLeftJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockDesc = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  innerJoin: mockInnerJoin,
  leftJoin: mockLeftJoin,
  orderBy: mockOrderBy,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockInnerJoin.mockReturnValue(chainedDb);
mockLeftJoin.mockReturnValue(chainedDb);
mockOrderBy.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  bids: { id: 'id', userId: 'userId', lotId: 'lotId', amount: 'amount', isWinning: 'isWinning', createdAt: 'createdAt' },
  bidRetractions: { id: 'id', bidId: 'bidId' },
  lots: { id: 'id', auctionId: 'auctionId', deletedAt: 'deletedAt', title: 'title', artist: 'artist', lotNumber: 'lotNumber', status: 'status' },
  auctions: { id: 'id', deletedAt: 'deletedAt', slug: 'slug', title: 'title', status: 'status' },
  media: { lotId: 'lotId', thumbnailUrl: 'thumbnailUrl', url: 'url', isPrimary: 'isPrimary', sortOrder: 'sortOrder', mediaType: 'mediaType', deletedAt: 'deletedAt' },
}));

describe('GET /api/user/bids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockInnerJoin.mockReturnValue(chainedDb);
    mockLeftJoin.mockReturnValue(chainedDb);
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null });

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 401 when user is admin type', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', userType: 'admin', role: 'admin' },
    });

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns empty bids for user with no bids', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'user', email: 'test@example.com' },
    });
    mockOrderBy.mockResolvedValueOnce([]); // no bids

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids).toEqual([]);
  });

  it('returns bids with lot and auction details', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'user', email: 'test@example.com' },
    });

    const userBids = [
      {
        bidId: 'bid-1',
        bidAmount: 5000,
        bidCreatedAt: new Date('2024-01-01'),
        bidIsWinning: true,
        lotId: 'lot-1',
        lotTitle: 'Painting',
        lotArtist: 'Monet',
        lotNumber: 1,
        lotStatus: 'active',
        auctionId: 'auction-1',
        auctionSlug: 'spring-2024',
        auctionTitle: 'Spring Auction 2024',
        auctionStatus: 'live',
      },
    ];
    mockOrderBy.mockResolvedValueOnce(userBids);

    // Image query
    mockOrderBy.mockResolvedValueOnce([
      { lotId: 'lot-1', thumbnailUrl: 'http://thumb.jpg', url: 'http://full.jpg', isPrimary: true, sortOrder: 0 },
    ]);

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids).toHaveLength(1);
    expect(body.bids[0].lotTitle).toBe('Painting');
    expect(body.bids[0].bidAmount).toBe(5000);
    expect(body.bids[0].isWinning).toBe(true);
    expect(body.bids[0].imageUrl).toBe('http://thumb.jpg');
  });

  it('deduplicates bids per lot (takes highest)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'user', email: 'test@example.com' },
    });

    // Two bids for same lot, ordered by desc amount
    const userBids = [
      {
        bidId: 'bid-2', bidAmount: 8000, bidCreatedAt: new Date(), bidIsWinning: true,
        lotId: 'lot-1', lotTitle: 'Painting', lotArtist: 'Monet', lotNumber: 1, lotStatus: 'active',
        auctionId: 'a1', auctionSlug: 'spring', auctionTitle: 'Spring', auctionStatus: 'live',
      },
      {
        bidId: 'bid-1', bidAmount: 5000, bidCreatedAt: new Date(), bidIsWinning: false,
        lotId: 'lot-1', lotTitle: 'Painting', lotArtist: 'Monet', lotNumber: 1, lotStatus: 'active',
        auctionId: 'a1', auctionSlug: 'spring', auctionTitle: 'Spring', auctionStatus: 'live',
      },
    ];
    mockOrderBy.mockResolvedValueOnce(userBids);
    mockOrderBy.mockResolvedValueOnce([]); // no images

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    // Only one bid per lot (the highest)
    expect(body.bids).toHaveLength(1);
    expect(body.bids[0].bidAmount).toBe(8000);
  });

  it('uses full URL when thumbnailUrl is null', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'user', email: 'test@example.com' },
    });

    const userBids = [{
      bidId: 'bid-1', bidAmount: 3000, bidCreatedAt: new Date(), bidIsWinning: false,
      lotId: 'lot-1', lotTitle: 'Sculpture', lotArtist: 'Rodin', lotNumber: 1, lotStatus: 'active',
      auctionId: 'a1', auctionSlug: 'winter', auctionTitle: 'Winter', auctionStatus: 'live',
    }];
    mockOrderBy.mockResolvedValueOnce(userBids);

    // Image without thumbnail
    mockOrderBy.mockResolvedValueOnce([
      { lotId: 'lot-1', thumbnailUrl: null, url: 'http://full-image.jpg', isPrimary: true, sortOrder: 0 },
    ]);

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids[0].imageUrl).toBe('http://full-image.jpg');
  });

  it('returns null imageUrl when lot has no images', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'user', email: 'test@example.com' },
    });

    const userBids = [{
      bidId: 'bid-1', bidAmount: 3000, bidCreatedAt: new Date(), bidIsWinning: false,
      lotId: 'lot-1', lotTitle: 'Lost Art', lotArtist: 'Unknown', lotNumber: 1, lotStatus: 'active',
      auctionId: 'a1', auctionSlug: 'spring', auctionTitle: 'Spring', auctionStatus: 'live',
    }];
    mockOrderBy.mockResolvedValueOnce(userBids);
    mockOrderBy.mockResolvedValueOnce([]); // no images

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids[0].imageUrl).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockAuth.mockRejectedValue(new Error('Auth service down'));

    const { GET } = await import('@/app/api/user/bids/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
