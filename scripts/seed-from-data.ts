/**
 * Seed script — migrates data from app/lib/data.ts into PostgreSQL.
 *
 * Usage:  npx tsx scripts/seed-from-data.ts
 *
 * Requires DATABASE_URL in .env (or exported).
 * Uses a single transaction — if anything fails, everything rolls back.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import * as schema from '../db/schema';

// Source data
import {
  auctions as srcAuctions,
  lots as srcLots,
  endedAuctionResults,
} from '../app/lib/data';

// YouTube URL detection (same regex as app/lib/utils.ts)
const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
function isYouTubeUrl(url: string): boolean {
  return YT_REGEX.test(url);
}

// ─── Status mappings ────────────────────────────────────────────────────────

type SrcAuctionStatus = 'ended' | 'live' | 'upcoming';
type DbAuctionStatus = 'archive' | 'live' | 'preview';

const auctionStatusMap: Record<SrcAuctionStatus, DbAuctionStatus> = {
  ended: 'archive',
  live: 'live',
  upcoming: 'preview',
};

function lotStatusForAuction(
  auctionStatus: SrcAuctionStatus,
  sold: boolean | null,
): 'sold' | 'passed' | 'active' | 'published' {
  if (auctionStatus === 'ended') {
    return sold ? 'sold' : 'passed';
  }
  if (auctionStatus === 'live') return 'active';
  return 'published'; // upcoming → preview
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse a date string into a Date, defaulting time to noon CET if no time component */
function parseDate(d: string): Date {
  if (d.includes('T')) return new Date(d);
  // Bare date like "2026-01-15" → treat as noon Europe/Warsaw
  return new Date(`${d}T12:00:00+01:00`);
}

// Build a lookup of endedAuctionResults by lotId
const endedResultsByLotId = new Map(
  endedAuctionResults.map((r) => [r.lotId, r]),
);

// Build a lookup of auction status by slug
const auctionStatusBySlug = new Map(
  srcAuctions.map((a) => [a.slug, a.status]),
);

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('Connecting to database…');
  // Quick connectivity check
  await pool.query('SELECT 1');
  console.log('Connected.\n');

  // Push schema (create/update tables)
  console.log('Pushing schema with drizzle-kit…');
  const { execSync } = await import('child_process');
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  console.log('Schema pushed.\n');

  // Counters
  let auctionCount = 0;
  let lotCount = 0;
  let mediaCount = 0;
  let bidCount = 0;

  // Run everything in a transaction
  await db.transaction(async (tx) => {
    // ── Truncate in FK-safe order ─────────────────────────────────────────
    console.log('Clearing existing data…');
    await tx.execute(sql`TRUNCATE TABLE bid_retractions CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE bids CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE absentee_bids CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE watched_lots CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE notifications CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE invoices CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE bid_registrations CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE sessions CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE verification_tokens CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE media CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE lots CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE auctions CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE admins CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE users CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE audit_log CASCADE`);
    console.log('Tables cleared.\n');

    // ── 1. Seed auctions ──────────────────────────────────────────────────
    console.log('Seeding auctions…');
    const auctionSlugToId = new Map<string, string>();

    for (let i = 0; i < srcAuctions.length; i++) {
      const a = srcAuctions[i];
      const [inserted] = await tx
        .insert(schema.auctions)
        .values({
          slug: a.slug,
          title: a.title,
          description: a.description,
          category: a.category,
          startDate: parseDate(a.date),
          endDate: parseDate(a.endDate),
          location: a.location,
          curator: a.curator,
          status: auctionStatusMap[a.status],
          visibilityLevel: '0',
          sortOrder: i,
        })
        .returning({ id: schema.auctions.id });

      auctionSlugToId.set(a.slug, inserted.id);
      auctionCount++;
      console.log(`  ✓ ${a.title} (${auctionStatusMap[a.status]})`);
    }

    // ── 2. Seed lots + media ──────────────────────────────────────────────
    console.log('\nSeeding lots & media…');
    const lotOldIdToNewId = new Map<string, string>();

    for (const lot of srcLots) {
      const auctionId = auctionSlugToId.get(lot.auctionSlug);
      if (!auctionId) {
        throw new Error(`Unknown auctionSlug: ${lot.auctionSlug}`);
      }

      const auctionStatus = auctionStatusBySlug.get(lot.auctionSlug)!;
      const endedResult = endedResultsByLotId.get(lot.id);
      const sold = endedResult?.sold ?? null;
      const status = lotStatusForAuction(auctionStatus, sold);
      const hammerPrice = endedResult?.hammerPrice ?? null;

      const [insertedLot] = await tx
        .insert(schema.lots)
        .values({
          auctionId,
          lotNumber: lot.lotNumber,
          title: lot.title,
          artist: lot.artist,
          description: lot.description,
          medium: lot.medium,
          dimensions: lot.dimensions,
          year: lot.year,
          estimateMin: lot.estimateMin,
          estimateMax: lot.estimateMax,
          hammerPrice,
          status,
          sortOrder: lot.lotNumber - 1,
          provenance: lot.provenance,
          exhibitions: lot.exhibited,
        })
        .returning({ id: schema.lots.id });

      lotOldIdToNewId.set(lot.id, insertedLot.id);
      lotCount++;

      // ── Media for this lot ────────────────────────────────────────────
      for (let j = 0; j < lot.images.length; j++) {
        const imgUrl = lot.images[j];
        const isYT = isYouTubeUrl(imgUrl);

        await tx.insert(schema.media).values({
          lotId: insertedLot.id,
          auctionId,
          mediaType: isYT ? 'youtube' : 'image',
          url: imgUrl,
          sortOrder: j,
          isPrimary: j === 0,
        });
        mediaCount++;
      }

      console.log(
        `  ✓ Lot #${lot.lotNumber}: ${lot.title} — ${lot.images.length} media`,
      );
    }

    // ── 3. Seed bids from endedAuctionResults ─────────────────────────────
    console.log('\nSeeding bids from ended auction results…');
    for (const result of endedAuctionResults) {
      if (!result.sold || !result.hammerPrice) continue;

      const lotId = lotOldIdToNewId.get(result.lotId);
      if (!lotId) continue;

      await tx.insert(schema.bids).values({
        lotId,
        amount: result.hammerPrice,
        bidType: 'floor',
        isWinning: true,
      });
      bidCount++;
      console.log(
        `  ✓ Bid for ${result.lotId}: ${result.hammerPrice.toLocaleString()} PLN`,
      );
    }

    // ── 4. Create admin account ───────────────────────────────────────────
    console.log('\nCreating admin account…');
    const passwordHash = await hash('Omena2026!', 12);
    await tx.insert(schema.admins).values({
      email: 'admin@omena.pl',
      passwordHash,
      name: 'Administrator',
      role: 'super_admin',
      isActive: true,
    });
    console.log('  ✓ admin@omena.pl (super_admin)\n');
  });

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('  Seed complete!');
  console.log(`  ${auctionCount} auctions`);
  console.log(`  ${lotCount} lots`);
  console.log(`  ${mediaCount} media records`);
  console.log(`  ${bidCount} bids`);
  console.log('  1 admin account');
  console.log('═══════════════════════════════════════════════════');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
