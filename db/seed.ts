/**
 * Seed script — inserts static auction & lot data from app/lib/data.ts into the database.
 * Also creates a default admin account.
 *
 * Usage: npx tsx db/seed.ts
 */

import { db } from './connection';
import { auctions, lots, media, admins } from './schema';
import { auctions as staticAuctions, lots as staticLots } from '../app/lib/data';
import bcrypt from 'bcryptjs';

// Map frontend status to DB status
function mapStatus(status: string): 'draft' | 'preview' | 'live' | 'reconciliation' | 'archive' {
  if (status === 'live') return 'live';
  if (status === 'ended') return 'archive';
  return 'preview'; // upcoming → preview
}

// Map frontend lot status based on auction status
function mapLotStatus(auctionStatus: string): 'draft' | 'catalogued' | 'published' | 'active' | 'sold' | 'passed' | 'withdrawn' {
  if (auctionStatus === 'live') return 'active';
  if (auctionStatus === 'ended') return 'sold';
  return 'published';
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  // 1. Create default admin account
  const adminPassword = await bcrypt.hash('admin1234', 12);
  const [admin] = await db
    .insert(admins)
    .values({
      email: 'michal@bialek.pl',
      passwordHash: adminPassword,
      name: 'Michał',
      role: 'super_admin',
      isActive: true,
    })
    .onConflictDoNothing({ target: admins.email })
    .returning();

  if (admin) {
    console.log(`✅ Admin created: michal@bialek.pl / admin1234`);
  } else {
    console.log(`ℹ️  Admin already exists: michal@bialek.pl`);
  }

  // 2. Insert auctions
  const auctionIdMap = new Map<string, string>(); // old slug → new UUID

  for (let i = 0; i < staticAuctions.length; i++) {
    const a = staticAuctions[i];
    const [inserted] = await db
      .insert(auctions)
      .values({
        slug: a.slug,
        title: a.title,
        description: a.description,
        category: a.category || 'mixed',
        startDate: new Date(a.date),
        endDate: new Date(a.endDate),
        location: a.location,
        curator: a.curator,
        status: mapStatus(a.status),
        visibilityLevel: '0',
        sortOrder: i,
      })
      .onConflictDoNothing({ target: auctions.slug })
      .returning();

    if (inserted) {
      auctionIdMap.set(a.slug, inserted.id);
      console.log(`✅ Auction: ${a.title} (${inserted.id})`);
    } else {
      // Already exists — fetch ID
      const existing = await db.query.auctions?.findFirst?.({
        where: (t: any, { eq }: any) => eq(t.slug, a.slug),
      });
      // Fallback: raw query
      const rows = await db.select({ id: auctions.id }).from(auctions).where(
        require('drizzle-orm').eq(auctions.slug, a.slug)
      ).limit(1);
      if (rows[0]) {
        auctionIdMap.set(a.slug, rows[0].id);
        console.log(`ℹ️  Auction exists: ${a.title}`);
      }
    }
  }

  // 3. Insert lots with media
  let lotCount = 0;

  for (const lot of staticLots) {
    const auctionId = auctionIdMap.get(lot.auctionSlug);
    if (!auctionId) {
      console.warn(`⚠️  Skipping lot ${lot.title}: auction ${lot.auctionSlug} not found`);
      continue;
    }

    const auctionData = staticAuctions.find((a) => a.slug === lot.auctionSlug);
    const lotStatus = mapLotStatus(auctionData?.status ?? 'upcoming');

    const [inserted] = await db
      .insert(lots)
      .values({
        auctionId,
        lotNumber: lot.lotNumber,
        title: lot.title,
        artist: lot.artist,
        description: lot.description,
        medium: lot.medium,
        dimensions: lot.dimensions,
        year: lot.year || null,
        estimateMin: lot.estimateMin,
        estimateMax: lot.estimateMax,
        status: lotStatus,
        sortOrder: lot.lotNumber - 1,
        provenance: lot.provenance || [],
        exhibitions: lot.exhibited || [],
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) continue;
    lotCount++;

    // Insert media for this lot
    const images = lot.images || [];
    for (let j = 0; j < images.length; j++) {
      const url = images[j];
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

      await db.insert(media).values({
        lotId: inserted.id,
        auctionId,
        mediaType: isYouTube ? 'youtube' : 'image',
        url,
        thumbnailUrl: isYouTube
          ? `https://img.youtube.com/vi/${extractYouTubeId(url)}/mqdefault.jpg`
          : url,
        isPrimary: j === 0 && !isYouTube,
        sortOrder: j,
      });
    }
  }

  console.log(`\n✅ Seeded ${auctionIdMap.size} auctions, ${lotCount} lots`);
  console.log('\n🔑 Admin login: michal@bialek.pl / admin1234');
  console.log('   Admin panel: /admin\n');

  process.exit(0);
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match?.[1] ?? '';
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
