import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bid-events so we can control subscribe/unsubscribe/emit
const subscribeBidsMock = vi.fn();
const unsubscribeBidsMock = vi.fn();

vi.mock('@/lib/bid-events', () => ({
  subscribeBids: subscribeBidsMock,
  unsubscribeBids: unsubscribeBidsMock,
  subscribeTimer: vi.fn(),
  unsubscribeTimer: vi.fn(),
  emitBid: vi.fn(),
  emitTimerEvent: vi.fn(),
}));

// Mock the DB connection — the route queries auctions table to verify existence
const limitMock = vi.fn();
const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
const fromMock = vi.fn().mockReturnValue({ where: whereMock });
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

vi.mock('@/db/connection', () => ({
  db: {
    select: selectMock,
  },
}));

// Mock next-auth/jwt so getToken doesn't fail
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

const FAKE_AUCTION_UUID = '00000000-1111-2222-3333-444444444444';

describe('SSE Auction Stream API', () => {
  beforeEach(() => {
    subscribeBidsMock.mockReset();
    unsubscribeBidsMock.mockReset();

    // Return a public auction (visibilityLevel '0') by default
    limitMock.mockResolvedValue([{ id: FAKE_AUCTION_UUID, visibilityLevel: '0' }]);
  });

  it('returns correct SSE headers', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');
    const { NextRequest } = await import('next/server');

    const controller = new AbortController();
    const request = new NextRequest(`http://localhost:3002/api/sse/auction/${FAKE_AUCTION_UUID}`, {
      signal: controller.signal,
    });

    const response = await GET(request, { params: Promise.resolve({ auctionId: FAKE_AUCTION_UUID }) });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    controller.abort();
  });

  it('subscribes to bid events for the given auctionId', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');
    const { NextRequest } = await import('next/server');

    const controller = new AbortController();
    const request = new NextRequest(`http://localhost:3002/api/sse/auction/${FAKE_AUCTION_UUID}`, {
      signal: controller.signal,
    });

    await GET(request, { params: Promise.resolve({ auctionId: FAKE_AUCTION_UUID }) });

    expect(subscribeBidsMock).toHaveBeenCalledWith(FAKE_AUCTION_UUID, expect.any(Function));

    controller.abort();
  });

  it('emits connected event with auctionId on stream start', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');
    const { NextRequest } = await import('next/server');

    const controller = new AbortController();
    const request = new NextRequest(`http://localhost:3002/api/sse/auction/${FAKE_AUCTION_UUID}`, {
      signal: controller.signal,
    });

    const response = await GET(request, { params: Promise.resolve({ auctionId: FAKE_AUCTION_UUID }) });

    // Read the first chunk from the stream
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('event: connected');
    expect(text).toContain(FAKE_AUCTION_UUID);

    reader.releaseLock();
    controller.abort();
  });

  it('forwards bid events to the stream when a bid is placed', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');
    const { NextRequest } = await import('next/server');

    let capturedCallback: ((data: unknown) => void) | null = null;

    subscribeBidsMock.mockImplementation((_auctionId: string, cb: (data: unknown) => void) => {
      capturedCallback = cb;
    });

    const controller = new AbortController();
    const request = new NextRequest(`http://localhost:3002/api/sse/auction/${FAKE_AUCTION_UUID}`, {
      signal: controller.signal,
    });

    const response = await GET(request, { params: Promise.resolve({ auctionId: FAKE_AUCTION_UUID }) });
    const reader = response.body!.getReader();

    // Consume the 'connected' event first
    await reader.read();

    // Simulate a bid event
    const bidEvent = {
      auctionId: FAKE_AUCTION_UUID,
      lotId: 'lot-123',
      amount: 1500,
      userId: 'user-456',
    };

    capturedCallback!(bidEvent);

    // Read the bid event chunk
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('event: bid');
    expect(text).toContain('"amount":1500');

    reader.releaseLock();
    controller.abort();
  });

  it('unsubscribes when client disconnects (aborts)', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');
    const { NextRequest } = await import('next/server');

    const controller = new AbortController();
    const request = new NextRequest(`http://localhost:3002/api/sse/auction/${FAKE_AUCTION_UUID}`, {
      signal: controller.signal,
    });

    await GET(request, { params: Promise.resolve({ auctionId: FAKE_AUCTION_UUID }) });

    // Abort to simulate client disconnect
    controller.abort();

    // Give the abort event handler time to fire
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(unsubscribeBidsMock).toHaveBeenCalledWith(FAKE_AUCTION_UUID, expect.any(Function));
  });

  it('handles different auctionIds independently', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');
    const { NextRequest } = await import('next/server');

    const auctionId1 = '11111111-1111-1111-1111-111111111111';
    const auctionId2 = '22222222-2222-2222-2222-222222222222';

    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

    const req1 = new NextRequest(`http://localhost:3002/api/sse/auction/${auctionId1}`, {
      signal: ctrl1.signal,
    });
    const req2 = new NextRequest(`http://localhost:3002/api/sse/auction/${auctionId2}`, {
      signal: ctrl2.signal,
    });

    await GET(req1, { params: Promise.resolve({ auctionId: auctionId1 }) });
    await GET(req2, { params: Promise.resolve({ auctionId: auctionId2 }) });

    const calls = subscribeBidsMock.mock.calls.map((c: [string, unknown]) => c[0]);
    expect(calls).toContain(auctionId1);
    expect(calls).toContain(auctionId2);

    ctrl1.abort();
    ctrl2.abort();
  });
});
