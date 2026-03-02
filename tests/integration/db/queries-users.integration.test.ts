import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';
import {
  getUserById,
  getUserByEmail,
  isUserRegisteredForAuction,
  listUsers,
  getUserDetail,
  getUserBidsPaginated,
  getUserRegistrationsPaginated,
  getUserWatchedLotsPaginated,
} from '@/db/queries/users';

describe('db/queries/users', () => {
  const db = getTestDb();
  let userId: string;
  let userEmail: string;
  let auctionId: string;
  let lotId: string;
  let registrationId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bidRegistrations } = await import('@/db/schema');

    // Create a test user
    const user = await createTestUser({
      email: `db-users-test-${Date.now()}@example.com`,
      name: 'DB Users Test User',
    });
    userId = user.id;
    userEmail = user.email;

    // Create auction and lot for bid/registration tests
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `db-users-auction-${Date.now()}`,
      title: 'DB Users Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'preview',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'DB Users Test Lot',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
      startingBid: 500,
    });

    // Register user for auction
    registrationId = randomUUID();
    await db.insert(bidRegistrations).values({
      id: registrationId,
      userId,
      auctionId,
      paddleNumber: 99,
      isApproved: true,
      approvedAt: new Date(),
    });
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRegistrations, watchedLots, users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(bids).where(eq(bids.lotId, lotId)).catch(() => {});
    await db.delete(watchedLots).where(eq(watchedLots.userId, userId)).catch(() => {});
    await db.delete(bidRegistrations).where(eq(bidRegistrations.auctionId, auctionId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
  });

  describe('getUserById', () => {
    it('returns user when found', async () => {
      const result = await getUserById(userId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(userId);
      expect(result!.email).toBe(userEmail);
    });

    it('returns null for unknown id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getUserById(randomUUID());
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted user', async () => {
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));

      const result = await getUserById(userId);
      expect(result).toBeNull();

      // Restore
      await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
    });
  });

  describe('getUserByEmail', () => {
    it('returns user when found by email', async () => {
      const result = await getUserByEmail(userEmail);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(userId);
    });

    it('returns null for unknown email', async () => {
      const result = await getUserByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted user', async () => {
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));

      const result = await getUserByEmail(userEmail);
      expect(result).toBeNull();

      await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
    });
  });

  describe('isUserRegisteredForAuction', () => {
    it('returns registered: true, approved: true for registered+approved user', async () => {
      const result = await isUserRegisteredForAuction(userId, auctionId);
      expect(result.registered).toBe(true);
      expect(result.approved).toBe(true);
    });

    it('returns registered: false for unregistered user', async () => {
      const { randomUUID } = await import('crypto');
      const result = await isUserRegisteredForAuction(userId, randomUUID());
      expect(result.registered).toBe(false);
      expect(result.approved).toBe(false);
    });

    it('returns registered: true, approved: false for unapproved registration', async () => {
      const { randomUUID } = await import('crypto');
      const { auctions, bidRegistrations } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const aId = randomUUID();
      const rId = randomUUID();

      await db.insert(auctions).values({
        id: aId,
        slug: `unapproved-test-${Date.now()}`,
        title: 'Unapproved Test',
        description: 'Test',
        category: 'mixed',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        location: 'Warsaw',
        curator: 'Test',
        status: 'preview',
        visibilityLevel: '0',
        buyersPremiumRate: '0.2000',
      });

      await db.insert(bidRegistrations).values({
        id: rId,
        userId,
        auctionId: aId,
        paddleNumber: 101,
        isApproved: false,
      });

      const result = await isUserRegisteredForAuction(userId, aId);
      expect(result.registered).toBe(true);
      expect(result.approved).toBe(false);

      // Cleanup
      await db.delete(bidRegistrations).where(eq(bidRegistrations.id, rId));
      await db.delete(auctions).where(eq(auctions.id, aId));
    });
  });

  describe('listUsers', () => {
    it('returns paginated users list', async () => {
      const result = await listUsers({ page: 1, limit: 10 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('finds user by email search', async () => {
      const result = await listUsers({ search: userEmail });
      expect(result.data.some((u) => u.id === userId)).toBe(true);
    });

    it('finds user by name search', async () => {
      const result = await listUsers({ search: 'DB Users Test User' });
      expect(result.data.some((u) => u.id === userId)).toBe(true);
    });

    it('filters by visibilityLevel', async () => {
      const result = await listUsers({ visibilityLevel: '0' });
      expect(result.data.every((u) => u.visibilityLevel === '0')).toBe(true);
    });

    it('filters by isActive', async () => {
      const result = await listUsers({ isActive: true });
      expect(result.data.every((u) => u.isActive === true)).toBe(true);
    });

    it('filters by isActive: false returns no active users', async () => {
      const result = await listUsers({ isActive: false });
      expect(result.data.every((u) => u.isActive === false)).toBe(true);
    });

    it('returns correct totalPages calculation', async () => {
      const result = await listUsers({ page: 1, limit: 1 });
      expect(result.totalPages).toBe(Math.ceil(result.total / 1));
    });

    it('does not include soft-deleted users', async () => {
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));

      const result = await listUsers({ search: userEmail });
      expect(result.data.some((u) => u.id === userId)).toBe(false);

      await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
    });

    it('uses default pagination (page=1, limit=20)', async () => {
      const result = await listUsers();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getUserDetail', () => {
    it('returns user detail with counts', async () => {
      const result = await getUserDetail(userId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(userId);
      expect(result).toHaveProperty('bidCount');
      expect(result).toHaveProperty('registrationCount');
      expect(result).toHaveProperty('watchedLotCount');
      expect(typeof result!.bidCount).toBe('number');
    });

    it('returns null for unknown user id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getUserDetail(randomUUID());
      expect(result).toBeNull();
    });

    it('includes referrerName when referrer exists', async () => {
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const referrer = await createTestUser({
        email: `db-users-referrer-${Date.now()}@example.com`,
        name: 'Referrer User',
      });

      await db.update(users).set({ referrerId: referrer.id }).where(eq(users.id, userId));

      const result = await getUserDetail(userId);
      expect(result!.referrerName).toBe('Referrer User');

      // Cleanup
      await db.update(users).set({ referrerId: null }).where(eq(users.id, userId));
      await db.delete(users).where(eq(users.id, referrer.id));
    });

    it('has null referrerName when no referrer', async () => {
      const result = await getUserDetail(userId);
      expect(result!.referrerName).toBeNull();
    });

    it('includes registration count from created registration', async () => {
      const result = await getUserDetail(userId);
      expect(result!.registrationCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getUserBidsPaginated', () => {
    it('returns paginated bids structure', async () => {
      const result = await getUserBidsPaginated(userId);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 20);
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns empty data for user with no bids', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getUserBidsPaginated(randomUUID());
      expect(result.total).toBe(0);
      expect(result.data.length).toBe(0);
    });

    it('returns bid details including lot and auction info', async () => {
      const { bids } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const { randomUUID } = await import('crypto');

      const bidId = randomUUID();
      await db.insert(bids).values({
        id: bidId,
        lotId,
        userId,
        amount: 750,
        bidType: 'online',
        isWinning: true,
      });

      const result = await getUserBidsPaginated(userId);
      expect(result.total).toBeGreaterThanOrEqual(1);

      const bid = result.data.find((b) => b.id === bidId);
      expect(bid).toBeDefined();
      expect(bid!.lotId).toBe(lotId);
      expect(bid!.auctionId).toBe(auctionId);
      expect(bid!.amount).toBe(750);

      // Cleanup
      await db.delete(bids).where(eq(bids.id, bidId));
    });

    it('respects page and limit params', async () => {
      const result = await getUserBidsPaginated(userId, 1, 5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
    });
  });

  describe('getUserRegistrationsPaginated', () => {
    it('returns paginated registrations structure', async () => {
      const result = await getUserRegistrationsPaginated(userId);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 20);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns registrations for the user', async () => {
      const result = await getUserRegistrationsPaginated(userId);
      expect(result.total).toBeGreaterThanOrEqual(1);

      const reg = result.data.find((r) => r.id === registrationId);
      expect(reg).toBeDefined();
      expect(reg!.auctionId).toBe(auctionId);
      expect(reg!.paddleNumber).toBe(99);
      expect(reg!.isApproved).toBe(true);
    });

    it('returns empty for user with no registrations', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getUserRegistrationsPaginated(randomUUID());
      expect(result.total).toBe(0);
      expect(result.data.length).toBe(0);
    });

    it('includes auction title and slug', async () => {
      const result = await getUserRegistrationsPaginated(userId);
      const reg = result.data[0];
      expect(reg).toHaveProperty('auctionTitle');
      expect(reg).toHaveProperty('auctionSlug');
    });
  });

  describe('getUserWatchedLotsPaginated', () => {
    it('returns paginated watched lots structure', async () => {
      const result = await getUserWatchedLotsPaginated(userId);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 20);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns empty for user with no watched lots', async () => {
      const result = await getUserWatchedLotsPaginated(userId);
      expect(result.total).toBe(0);
    });

    it('returns watched lot with lot and auction info', async () => {
      const { watchedLots } = await import('@/db/schema');
      const { eq, and } = await import('drizzle-orm');

      await db.insert(watchedLots).values({
        userId,
        lotId,
      });

      const result = await getUserWatchedLotsPaginated(userId);
      expect(result.total).toBeGreaterThanOrEqual(1);

      const watched = result.data.find((w) => w.lotId === lotId);
      expect(watched).toBeDefined();
      expect(watched!.auctionId).toBe(auctionId);
      expect(watched!.lotTitle).toBeDefined();
      expect(watched!.auctionTitle).toBeDefined();

      // Cleanup
      await db.delete(watchedLots).where(and(eq(watchedLots.userId, userId), eq(watchedLots.lotId, lotId)));
    });

    it('respects page and limit params', async () => {
      const result = await getUserWatchedLotsPaginated(userId, 2, 5);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });
});
