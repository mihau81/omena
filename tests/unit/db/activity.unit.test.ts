import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockSelectOffset = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockSelectOrderBy = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectFrom = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

// ─── Wire up chainable db mock ───────────────────────────────────────────────

vi.mock('@/db/connection', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock('@/db/schema', () => ({
  userLogins: {
    id: 'userLogins.id',
    userId: 'userLogins.userId',
    email: 'userLogins.email',
    ipAddress: 'userLogins.ipAddress',
    userAgent: 'userLogins.userAgent',
    countryCode: 'userLogins.countryCode',
    city: 'userLogins.city',
    success: 'userLogins.success',
    failReason: 'userLogins.failReason',
    loginMethod: 'userLogins.loginMethod',
    createdAt: 'userLogins.createdAt',
  },
  pageViews: {
    id: 'pageViews.id',
    userId: 'pageViews.userId',
    path: 'pageViews.path',
    ipAddress: 'pageViews.ipAddress',
    userAgent: 'pageViews.userAgent',
    createdAt: 'pageViews.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
  count: vi.fn(() => ({ _count: true })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  gte: vi.fn((...args: unknown[]) => ({ _gte: args })),
  lte: vi.fn((...args: unknown[]) => ({ _lte: args })),
  or: vi.fn((...args: unknown[]) => ({ _or: args })),
}));

// ─── Import under test ───────────────────────────────────────────────────────

import {
  getUserLoginsPaginated,
  getLoginsByEmailPaginated,
  getUserPageViewsPaginated,
} from '@/db/queries/activity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupSelectChain(rows: unknown[], total: number) {
  // First call = rows query (full chain), second call = count query
  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;
    if (callCount % 2 === 1) {
      // Data rows call: select → from → where → orderBy → limit → offset
      mockSelectOffset.mockResolvedValue(rows);
      mockSelectLimit.mockReturnValue({ offset: mockSelectOffset });
      mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
      mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      return { from: mockSelectFrom };
    } else {
      // Count call: select → from → where
      const mockCountWhere = vi.fn().mockResolvedValue([{ total }]);
      const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });
      return { from: mockCountFrom };
    }
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getUserLoginsPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated data with total and page info', async () => {
    const mockRows = [
      {
        id: 1,
        email: 'user@test.com',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        countryCode: 'PL',
        city: 'Warsaw',
        success: true,
        failReason: null,
        loginMethod: 'credentials',
        createdAt: new Date('2024-01-01'),
      },
    ];
    setupSelectChain(mockRows, 1);

    const result = await getUserLoginsPaginated('user-123');

    expect(result.data).toEqual(mockRows);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it('uses default page=1 and limit=20', async () => {
    setupSelectChain([], 0);

    const result = await getUserLoginsPaginated('user-123');

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('uses custom page and limit', async () => {
    setupSelectChain([], 100);

    const result = await getUserLoginsPaginated('user-123', 3, 10);

    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('calculates correct totalPages for exact division', async () => {
    setupSelectChain([], 40);

    const result = await getUserLoginsPaginated('user-123', 1, 20);

    expect(result.totalPages).toBe(2);
  });

  it('calculates correct totalPages rounding up', async () => {
    setupSelectChain([], 41);

    const result = await getUserLoginsPaginated('user-123', 1, 20);

    expect(result.totalPages).toBe(3);
  });

  it('returns totalPages=0 when there are no records', async () => {
    setupSelectChain([], 0);

    const result = await getUserLoginsPaginated('user-123');

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates correct offset for page 2', async () => {
    setupSelectChain([], 50);

    await getUserLoginsPaginated('user-123', 2, 20);

    // offset should be (2-1)*20 = 20
    expect(mockSelectOffset).toHaveBeenCalledWith(20);
  });

  it('calculates correct offset for page 1 (zero offset)', async () => {
    setupSelectChain([], 10);

    await getUserLoginsPaginated('user-123', 1, 10);

    expect(mockSelectOffset).toHaveBeenCalledWith(0);
  });

  it('calls limit with the provided limit value', async () => {
    setupSelectChain([], 100);

    await getUserLoginsPaginated('user-123', 1, 15);

    expect(mockSelectLimit).toHaveBeenCalledWith(15);
  });

  it('returns empty data array when no rows found', async () => {
    setupSelectChain([], 0);

    const result = await getUserLoginsPaginated('user-123');

    expect(result.data).toEqual([]);
  });

  it('returns multiple rows', async () => {
    const mockRows = [
      { id: 1, email: 'a@test.com', success: true },
      { id: 2, email: 'b@test.com', success: false },
      { id: 3, email: 'c@test.com', success: true },
    ];
    setupSelectChain(mockRows, 3);

    const result = await getUserLoginsPaginated('user-xyz');

    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('calculates offset correctly for page 5 with limit 10', async () => {
    setupSelectChain([], 100);

    await getUserLoginsPaginated('user-123', 5, 10);

    expect(mockSelectOffset).toHaveBeenCalledWith(40);
  });

  it('handles rows with null values (failed logins)', async () => {
    const mockRows = [
      {
        id: 10,
        email: 'attacker@evil.com',
        ipAddress: '1.2.3.4',
        userAgent: null,
        countryCode: null,
        city: null,
        success: false,
        failReason: 'invalid_password',
        loginMethod: 'credentials',
        createdAt: new Date('2024-06-01'),
      },
    ];
    setupSelectChain(mockRows, 1);

    const result = await getUserLoginsPaginated('user-123');

    expect(result.data[0].failReason).toBe('invalid_password');
    expect(result.data[0].success).toBe(false);
    expect(result.data[0].userAgent).toBeNull();
  });

  it('issues exactly two select queries (data + count) via Promise.all', async () => {
    setupSelectChain([], 0);

    await getUserLoginsPaginated('user-123');

    // One call for the paginated rows, one for the total count
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});

// ─── getLoginsByEmailPaginated ────────────────────────────────────────────────

describe('getLoginsByEmailPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated data filtered by email', async () => {
    const mockRows = [
      {
        id: 5,
        email: 'someone@test.com',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome',
        countryCode: 'US',
        city: 'New York',
        success: true,
        failReason: null,
        loginMethod: 'magic_link',
        createdAt: new Date('2024-03-01'),
      },
    ];
    setupSelectChain(mockRows, 1);

    const result = await getLoginsByEmailPaginated('someone@test.com');

    expect(result.data).toEqual(mockRows);
    expect(result.total).toBe(1);
  });

  it('uses default page=1 and limit=20', async () => {
    setupSelectChain([], 0);

    const result = await getLoginsByEmailPaginated('test@test.com');

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('accepts custom page and limit', async () => {
    setupSelectChain([], 200);

    const result = await getLoginsByEmailPaginated('test@test.com', 2, 50);

    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('returns totalPages=0 when no records', async () => {
    setupSelectChain([], 0);

    const result = await getLoginsByEmailPaginated('nobody@test.com');

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates totalPages correctly', async () => {
    setupSelectChain([], 45);

    const result = await getLoginsByEmailPaginated('test@test.com', 1, 20);

    expect(result.totalPages).toBe(3);
  });

  it('calculates correct offset for page 3 with limit 10', async () => {
    setupSelectChain([], 100);

    await getLoginsByEmailPaginated('test@test.com', 3, 10);

    expect(mockSelectOffset).toHaveBeenCalledWith(20);
  });

  it('returns empty data for non-existent email', async () => {
    setupSelectChain([], 0);

    const result = await getLoginsByEmailPaginated('noone@test.com');

    expect(result.data).toEqual([]);
  });

  it('can include failed logins where userId is null (catches non-existent users)', async () => {
    const mockRows = [
      {
        id: 99,
        email: 'probe@evil.com',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.88',
        countryCode: null,
        city: null,
        success: false,
        failReason: 'not_found',
        loginMethod: 'credentials',
        createdAt: new Date('2024-07-01'),
      },
    ];
    setupSelectChain(mockRows, 1);

    const result = await getLoginsByEmailPaginated('probe@evil.com');

    expect(result.data[0].failReason).toBe('not_found');
    expect(result.data[0].success).toBe(false);
  });

  it('returns correct page in the result', async () => {
    setupSelectChain([], 60);

    const result = await getLoginsByEmailPaginated('test@test.com', 4, 15);

    expect(result.page).toBe(4);
  });
});

// ─── getUserPageViewsPaginated ────────────────────────────────────────────────

describe('getUserPageViewsPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated page views data', async () => {
    const mockRows = [
      {
        id: 1,
        path: '/auctions/spring-2024',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2024-04-01'),
      },
    ];
    setupSelectChain(mockRows, 1);

    const result = await getUserPageViewsPaginated('user-abc');

    expect(result.data).toEqual(mockRows);
    expect(result.total).toBe(1);
  });

  it('uses default page=1 and limit=30', async () => {
    setupSelectChain([], 0);

    const result = await getUserPageViewsPaginated('user-abc');

    expect(result.page).toBe(1);
    expect(result.limit).toBe(30);
  });

  it('accepts custom page and limit', async () => {
    setupSelectChain([], 300);

    const result = await getUserPageViewsPaginated('user-abc', 5, 50);

    expect(result.page).toBe(5);
    expect(result.limit).toBe(50);
  });

  it('returns totalPages=0 when no page views', async () => {
    setupSelectChain([], 0);

    const result = await getUserPageViewsPaginated('new-user');

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates totalPages correctly rounding up', async () => {
    setupSelectChain([], 31);

    const result = await getUserPageViewsPaginated('user-abc', 1, 30);

    expect(result.totalPages).toBe(2);
  });

  it('calculates totalPages correctly for exact division', async () => {
    setupSelectChain([], 90);

    const result = await getUserPageViewsPaginated('user-abc', 1, 30);

    expect(result.totalPages).toBe(3);
  });

  it('calculates correct offset for page 2 with limit 30', async () => {
    setupSelectChain([], 60);

    await getUserPageViewsPaginated('user-abc', 2, 30);

    expect(mockSelectOffset).toHaveBeenCalledWith(30);
  });

  it('calculates correct offset for page 1 (zero offset)', async () => {
    setupSelectChain([], 10);

    await getUserPageViewsPaginated('user-abc', 1, 30);

    expect(mockSelectOffset).toHaveBeenCalledWith(0);
  });

  it('returns empty data array when no page views found', async () => {
    setupSelectChain([], 0);

    const result = await getUserPageViewsPaginated('ghost-user');

    expect(result.data).toEqual([]);
  });

  it('returns multiple page view rows', async () => {
    const mockRows = [
      { id: 1, path: '/lots/1', ipAddress: '1.1.1.1', userAgent: 'Safari', createdAt: new Date() },
      { id: 2, path: '/auctions', ipAddress: '2.2.2.2', userAgent: 'Firefox', createdAt: new Date() },
    ];
    setupSelectChain(mockRows, 2);

    const result = await getUserPageViewsPaginated('user-xyz');

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('handles rows with null ipAddress and userAgent', async () => {
    const mockRows = [
      {
        id: 7,
        path: '/home',
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2024-05-01'),
      },
    ];
    setupSelectChain(mockRows, 1);

    const result = await getUserPageViewsPaginated('user-anonymous');

    expect(result.data[0].ipAddress).toBeNull();
    expect(result.data[0].userAgent).toBeNull();
  });

  it('calls select twice (data query + count query)', async () => {
    setupSelectChain([], 0);

    await getUserPageViewsPaginated('user-123');

    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('limit called with correct limit value', async () => {
    setupSelectChain([], 200);

    await getUserPageViewsPaginated('user-abc', 1, 25);

    expect(mockSelectLimit).toHaveBeenCalledWith(25);
  });
});
