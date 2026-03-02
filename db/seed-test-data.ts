/**
 * Seed script — inserts test users, bid registrations, bids, and watched lots.
 * Reads existing auctions/lots from DB to create FK-consistent data.
 *
 * Usage: npx tsx db/seed-test-data.ts
 */

import { db } from './connection';
import { users, bids, bidRegistrations, watchedLots, lots, auctions } from './schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const TEST_PASSWORD = 'User2026';

const TEST_USERS = [
  // Approved users
  { name: 'Jan Kowalski', email: 'jan.kowalski@example.com', phone: '+48501234567', city: 'Warszawa', status: 'approved' as const },
  { name: 'Maria Nowak', email: 'maria.nowak@example.com', phone: '+48502345678', city: 'Kraków', status: 'approved' as const },
  { name: 'Piotr Wiśniewski', email: 'piotr.wisniewski@example.com', phone: '+48503456789', city: 'Poznań', status: 'approved' as const },
  { name: 'Anna Zielińska', email: 'anna.zielinska@example.com', phone: '+48504567890', city: 'Wrocław', status: 'approved' as const },
  { name: 'Tomasz Szymański', email: 'tomasz.szymanski@example.com', phone: '+48505678901', city: 'Gdańsk', status: 'approved' as const },
  { name: 'Katarzyna Dąbrowska', email: 'katarzyna.dabrowska@example.com', phone: '+48506789012', city: 'Łódź', status: 'approved' as const },
  { name: 'Michał Lewandowski', email: 'michal.lewandowski@example.com', phone: '+48507890123', city: 'Katowice', status: 'approved' as const },
  { name: 'Agnieszka Wójcik', email: 'agnieszka.wojcik@example.com', phone: '+48508901234', city: 'Lublin', status: 'approved' as const },
  // Pending users
  { name: 'Robert Kamiński', email: 'robert.kaminski@example.com', phone: '+48509012345', city: 'Szczecin', status: 'pending_approval' as const },
  { name: 'Ewa Jankowska', email: 'ewa.jankowska@example.com', phone: '+48510123456', city: 'Bydgoszcz', status: 'pending_approval' as const },
  { name: 'Krzysztof Mazur', email: 'krzysztof.mazur@example.com', phone: '', city: 'Rzeszów', status: 'pending_verification' as const },
  { name: 'Monika Krawczyk', email: 'monika.krawczyk@example.com', phone: '', city: 'Olsztyn', status: 'pending_verification' as const },
  { name: 'Paweł Zając', email: 'pawel.zajac@example.com', phone: '+48512345678', city: 'Toruń', status: 'pending_approval' as const },
];

const BID_TYPES = ['online', 'phone', 'floor'] as const;

async function seed() {
  console.log('🌱 Seeding test data...\n');

  // 1. Hash password once
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  // 2. Insert users
  const insertedUsers: Array<{ id: string; name: string; status: string }> = [];

  for (const u of TEST_USERS) {
    const isApproved = u.status === 'approved';
    const [inserted] = await db
      .insert(users)
      .values({
        email: u.email,
        passwordHash,
        name: u.name,
        phone: u.phone,
        city: u.city,
        country: 'Poland',
        accountStatus: u.status,
        emailVerified: isApproved,
        emailVerifiedAt: isApproved ? new Date() : null,
        approvedAt: isApproved ? new Date() : null,
        registrationSource: 'direct',
        isActive: true,
        lastLoginAt: isApproved ? new Date(Date.now() - Math.random() * 7 * 86400000) : null,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, name: users.name, accountStatus: users.accountStatus });

    if (inserted) {
      insertedUsers.push({ id: inserted.id, name: inserted.name, status: inserted.accountStatus });
      console.log(`✅ User: ${u.name} (${u.status})`);
    } else {
      // Already exists — fetch
      const [existing] = await db
        .select({ id: users.id, name: users.name, accountStatus: users.accountStatus })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);
      if (existing) {
        insertedUsers.push({ id: existing.id, name: existing.name, status: existing.accountStatus });
        console.log(`ℹ️  User exists: ${u.name}`);
      }
    }
  }

  const approvedUsers = insertedUsers.filter((u) => u.status === 'approved');
  console.log(`\n👥 ${insertedUsers.length} users total, ${approvedUsers.length} approved\n`);

  // 3. Get existing auctions
  const existingAuctions = await db
    .select({ id: auctions.id, title: auctions.title, status: auctions.status })
    .from(auctions)
    .where(isNull(auctions.deletedAt));

  console.log(`📦 Found ${existingAuctions.length} auctions\n`);

  // 4. Get existing lots (active/sold only for bidding)
  const biddableLots = await db
    .select({
      id: lots.id,
      auctionId: lots.auctionId,
      lotNumber: lots.lotNumber,
      title: lots.title,
      status: lots.status,
      estimateMin: lots.estimateMin,
      estimateMax: lots.estimateMax,
    })
    .from(lots)
    .where(and(isNull(lots.deletedAt), inArray(lots.status, ['active', 'sold', 'published'])));

  console.log(`🎨 Found ${biddableLots.length} biddable lots\n`);

  // 5. Create bid registrations for approved users on live/preview auctions
  const livePreviewAuctions = existingAuctions.filter((a) => ['live', 'preview'].includes(a.status));
  let regCount = 0;

  for (const auction of livePreviewAuctions) {
    // Register 4-6 random approved users per auction
    const numRegistrations = Math.min(approvedUsers.length, 4 + Math.floor(Math.random() * 3));
    const shuffled = [...approvedUsers].sort(() => Math.random() - 0.5);
    const toRegister = shuffled.slice(0, numRegistrations);

    for (let i = 0; i < toRegister.length; i++) {
      const user = toRegister[i];
      const paddleNumber = 100 + i + 1; // 101, 102, 103...

      const [reg] = await db
        .insert(bidRegistrations)
        .values({
          userId: user.id,
          auctionId: auction.id,
          paddleNumber,
          isApproved: true,
          approvedAt: new Date(Date.now() - Math.random() * 3 * 86400000),
          depositPaid: Math.random() > 0.3,
        })
        .onConflictDoNothing()
        .returning();

      if (reg) {
        regCount++;
        console.log(`🎫 Registration: ${user.name} → ${auction.title} (paddle #${paddleNumber})`);
      }
    }
  }

  // Also register some users for archive/reconciliation auctions
  const otherAuctions = existingAuctions.filter((a) => ['archive', 'reconciliation'].includes(a.status));
  for (const auction of otherAuctions) {
    const numRegistrations = Math.min(approvedUsers.length, 3 + Math.floor(Math.random() * 3));
    const shuffled = [...approvedUsers].sort(() => Math.random() - 0.5);
    const toRegister = shuffled.slice(0, numRegistrations);

    for (let i = 0; i < toRegister.length; i++) {
      const user = toRegister[i];
      const paddleNumber = 200 + i + 1;

      const [reg] = await db
        .insert(bidRegistrations)
        .values({
          userId: user.id,
          auctionId: auction.id,
          paddleNumber,
          isApproved: true,
          approvedAt: new Date(Date.now() - 30 * 86400000 - Math.random() * 60 * 86400000),
          depositPaid: true,
        })
        .onConflictDoNothing()
        .returning();

      if (reg) regCount++;
    }
  }

  console.log(`\n🎫 ${regCount} bid registrations created\n`);

  // 6. Fetch all registrations (to link bids properly)
  const allRegistrations = await db
    .select({
      id: bidRegistrations.id,
      userId: bidRegistrations.userId,
      auctionId: bidRegistrations.auctionId,
      paddleNumber: bidRegistrations.paddleNumber,
    })
    .from(bidRegistrations);

  // 7. Create bids on active/sold lots
  let bidCount = 0;
  const activeSoldLots = biddableLots.filter((l) => ['active', 'sold'].includes(l.status));

  for (const lot of activeSoldLots) {
    // Find users registered for this lot's auction
    const eligibleRegs = allRegistrations.filter((r) => r.auctionId === lot.auctionId);
    if (eligibleRegs.length === 0) continue;

    // 2-5 bids per lot
    const numBids = 2 + Math.floor(Math.random() * 4);
    const minBid = lot.estimateMin || 1000;
    const maxBid = Math.max(minBid, (lot.estimateMax || minBid * 2)) * 1.5;
    const step = Math.max(500, Math.round((maxBid - minBid) / (numBids + 1) / 500) * 500);

    let highestBidAmount = 0;
    let highestBidId: string | null = null;

    for (let i = 0; i < numBids; i++) {
      const reg = eligibleRegs[i % eligibleRegs.length];
      const amount = Math.round((minBid + step * (i + 1)) / 100) * 100; // Round to nearest 100
      const bidType = BID_TYPES[Math.floor(Math.random() * BID_TYPES.length)];
      const createdAt = new Date(Date.now() - (numBids - i) * 3600000 - Math.random() * 86400000 * 7);

      const [inserted] = await db
        .insert(bids)
        .values({
          lotId: lot.id,
          userId: bidType === 'floor' ? null : reg.userId,
          registrationId: reg.id,
          amount,
          bidType,
          paddleNumber: reg.paddleNumber,
          isWinning: false,
          createdAt,
        })
        .returning();

      if (inserted) {
        bidCount++;
        if (amount > highestBidAmount) {
          highestBidAmount = amount;
          highestBidId = inserted.id;
        }
      }
    }

    // Mark highest bid as winning for sold lots, update hammerPrice
    if (lot.status === 'sold' && highestBidId) {
      await db
        .update(bids)
        .set({ isWinning: true })
        .where(eq(bids.id, highestBidId));

      await db
        .update(lots)
        .set({ hammerPrice: highestBidAmount })
        .where(eq(lots.id, lot.id));

      console.log(`🔨 Lot #${lot.lotNumber} "${lot.title}" → hammer PLN ${highestBidAmount.toLocaleString()}`);
    }
  }

  // Add a few bids on published lots too (absentee-style, lower amounts)
  const publishedLots = biddableLots.filter((l) => l.status === 'published').slice(0, 5);
  for (const lot of publishedLots) {
    const eligibleRegs = allRegistrations.filter((r) => r.auctionId === lot.auctionId);
    if (eligibleRegs.length === 0) continue;

    const reg = eligibleRegs[0];
    const amount = lot.estimateMin || 1000;

    await db.insert(bids).values({
      lotId: lot.id,
      userId: reg.userId,
      registrationId: reg.id,
      amount,
      bidType: 'online',
      paddleNumber: reg.paddleNumber,
      isWinning: false,
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 3),
    });
    bidCount++;
  }

  console.log(`\n💰 ${bidCount} bids created\n`);

  // 8. Create watched lots (random user-lot pairs)
  let watchCount = 0;
  const allLots = biddableLots;

  for (let i = 0; i < 10; i++) {
    const user = approvedUsers[Math.floor(Math.random() * approvedUsers.length)];
    const lot = allLots[Math.floor(Math.random() * allLots.length)];
    if (!user || !lot) continue;

    const [inserted] = await db
      .insert(watchedLots)
      .values({
        userId: user.id,
        lotId: lot.id,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) watchCount++;
  }

  console.log(`👁️  ${watchCount} watched lots created\n`);

  // Summary
  console.log('─'.repeat(50));
  console.log(`✅ Seed complete!`);
  console.log(`   Users: ${insertedUsers.length} (${approvedUsers.length} approved)`);
  console.log(`   Bid registrations: ${regCount}`);
  console.log(`   Bids: ${bidCount}`);
  console.log(`   Watched lots: ${watchCount}`);
  console.log(`   Test password for all users: ${TEST_PASSWORD}`);
  console.log('─'.repeat(50));

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
