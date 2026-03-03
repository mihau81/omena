/**
 * Unit tests for GET /api/sse/auction/[auctionId]
 * Coverage target: SSE stream setup, auth for non-public auctions,
 * validation, 404, and stream headers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock bid-events ────────────────────────────────────────────────────────

const mockSubscribeBids = vi.fn();
const mockUnsubscribeBids = vi.fn();
const mockSubscribeTimer = vi.fn();
const mockUnsubscribeTimer = vi.fn();

vi.mock('@/lib/bid-events', () => ({
  subscribeBids: (...args: unknown[]) => mockSubscribeBids(...args),
  unsubscribeBids: (...args: unknown[]) => mockUnsubscribeBids(...args),
  subscribeTimer: (...args: unknown[]) => mockSubscribeTimer(...args),
  unsubscribeTimer: (...args: unknown[]) => mockUnsubscribeTimer(...args),
  emitBid: vi.fn(),
  emitTimerEvent: vi.fn(),
}));

// ─── Mock lot-timer ─────────────────────────────────────────────────────────

vi.mock('@/lib/lot-timer', () => ({
  checkExpiredLots: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock Sentry ────────────────────────────────────────────────────────────

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('@/db/connection', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock('@/db/schema', () => ({
  auctions: { id: 'id', visibilityLevel: 'visibilityLevel', deletedAt: 'deletedAt' },
}));

// ─── Mock next-auth/jwt ─────────────────────────────────────────────────────

const mockGetToken = vi.fn();
vi.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-1111-2222-3333-444444444444';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(auctionId: string, signal?: AbortSignal) {
  const { NextRequest } = require('next/server');
  return new NextRequest(`http://localhost:3000/api/sse/auction/${auctionId}`, {
    signal: signal ?? new AbortController().signal,
  });
}

function makeContext(auctionId: string) {
  return { params: Promise.resolve({ auctionId }) };
}

describe('GET /api/sse/auction/[auctionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([{ id: VALID_UUID, visibilityLevel: '0' }]);
    mockGetToken.mockResolvedValue(null);
  });

  it('returns 400 for invalid (non-UUID) auctionId', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest('not-a-uuid', controller.signal), makeContext('not-a-uuid'));

    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe('Invalid auction ID');
    controller.abort();
  });

  it('returns 404 when auction not found', async () => {
    mockLimit.mockResolvedValue([]);

    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe('Auction not found');
    controller.abort();
  });

  it('returns 401 for non-public auction when user lacks visibility', async () => {
    mockLimit.mockResolvedValue([{ id: VALID_UUID, visibilityLevel: '2' }]);
    mockGetToken.mockResolvedValue({ visibilityLevel: 1 });

    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe('Unauthorized');
    controller.abort();
  });

  it('returns 401 for non-public auction when no token', async () => {
    mockLimit.mockResolvedValue([{ id: VALID_UUID, visibilityLevel: '1' }]);
    mockGetToken.mockResolvedValue(null);

    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    expect(res.status).toBe(401);
    controller.abort();
  });

  it('allows non-public auction when user has sufficient visibility', async () => {
    mockLimit.mockResolvedValue([{ id: VALID_UUID, visibilityLevel: '1' }]);
    mockGetToken.mockResolvedValue({ visibilityLevel: 2 });

    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    controller.abort();
  });

  it('returns correct SSE headers for public auction', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');
    controller.abort();
  });

  it('subscribes to bid and timer events', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    // Read first chunk to trigger start()
    const reader = res.body!.getReader();
    await reader.read();

    expect(mockSubscribeBids).toHaveBeenCalledWith(VALID_UUID, expect.any(Function));
    expect(mockSubscribeTimer).toHaveBeenCalledWith(VALID_UUID, expect.any(Function));

    reader.releaseLock();
    controller.abort();
  });

  it('emits connected event with auctionId', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('event: connected');
    expect(text).toContain(VALID_UUID);

    reader.releaseLock();
    controller.abort();
  });

  it('forwards bid events to the stream', async () => {
    let capturedBidCb: ((data: unknown) => void) | null = null;
    mockSubscribeBids.mockImplementation((_id: string, cb: (data: unknown) => void) => {
      capturedBidCb = cb;
    });

    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    const reader = res.body!.getReader();
    // Consume connected event
    await reader.read();

    const bidEvent = { lotId: 'lot-1', auctionId: VALID_UUID, amount: 2000, isWinning: true, timestamp: new Date().toISOString(), nextMinBid: 2200 };
    capturedBidCb!(bidEvent);

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('event: bid');
    expect(text).toContain('"amount":2000');

    reader.releaseLock();
    controller.abort();
  });

  it('forwards timer events to the stream', async () => {
    let capturedTimerCb: ((data: unknown) => void) | null = null;
    mockSubscribeTimer.mockImplementation((_id: string, cb: (data: unknown) => void) => {
      capturedTimerCb = cb;
    });

    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    const reader = res.body!.getReader();
    // Consume connected event
    await reader.read();

    const timerEvent = { type: 'lot:timer:start', lotId: 'lot-1', closingAt: new Date().toISOString(), durationSeconds: 120 };
    capturedTimerCb!(timerEvent);

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('event: lot:timer:start');
    expect(text).toContain('lot-1');

    reader.releaseLock();
    controller.abort();
  });

  it('unsubscribes on client disconnect', async () => {
    const { GET } = await import('@/app/api/sse/auction/[auctionId]/route');

    const controller = new AbortController();
    const res = await GET(makeRequest(VALID_UUID, controller.signal), makeContext(VALID_UUID));

    // Read to ensure stream is started
    const reader = res.body!.getReader();
    await reader.read();
    reader.releaseLock();

    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockUnsubscribeBids).toHaveBeenCalledWith(VALID_UUID, expect.any(Function));
    expect(mockUnsubscribeTimer).toHaveBeenCalledWith(VALID_UUID, expect.any(Function));
  });
});
