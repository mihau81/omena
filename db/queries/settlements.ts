import { eq, and, desc } from 'drizzle-orm';
import { db } from '../connection';
import { settlements, settlementItems, consignors, auctions, lots } from '../schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateSettlementData {
  consignorId: string;
  auctionId: string;
  createdBy: string;
}

// ─── List settlements (with filters) ─────────────────────────────────────────

interface ListSettlementsFilters {
  consignorId?: string;
  auctionId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listSettlements(filters: ListSettlementsFilters = {}) {
  const { limit = 100, offset = 0 } = filters;

  const conditions = [];
  if (filters.consignorId) conditions.push(eq(settlements.consignorId, filters.consignorId));
  if (filters.auctionId) conditions.push(eq(settlements.auctionId, filters.auctionId));
  if (filters.status) conditions.push(eq(settlements.status, filters.status as 'pending' | 'approved' | 'paid'));

  const rows = await db
    .select({
      id:               settlements.id,
      consignorId:      settlements.consignorId,
      consignorName:    consignors.name,
      auctionId:        settlements.auctionId,
      auctionTitle:     auctions.title,
      totalHammer:      settlements.totalHammer,
      commissionAmount: settlements.commissionAmount,
      netPayout:        settlements.netPayout,
      status:           settlements.status,
      paidAt:           settlements.paidAt,
      bankReference:    settlements.bankReference,
      notes:            settlements.notes,
      createdAt:        settlements.createdAt,
      updatedAt:        settlements.updatedAt,
      createdBy:        settlements.createdBy,
    })
    .from(settlements)
    .innerJoin(consignors, eq(consignors.id, settlements.consignorId))
    .innerJoin(auctions, eq(auctions.id, settlements.auctionId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(settlements.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

// ─── Get single settlement with items ────────────────────────────────────────

export async function getSettlementById(id: string) {
  const [row] = await db
    .select({
      id:               settlements.id,
      consignorId:      settlements.consignorId,
      consignorName:    consignors.name,
      consignorEmail:   consignors.email,
      consignorCompany: consignors.companyName,
      consignorTaxId:   consignors.taxId,
      auctionId:        settlements.auctionId,
      auctionTitle:     auctions.title,
      totalHammer:      settlements.totalHammer,
      commissionAmount: settlements.commissionAmount,
      netPayout:        settlements.netPayout,
      status:           settlements.status,
      paidAt:           settlements.paidAt,
      bankReference:    settlements.bankReference,
      notes:            settlements.notes,
      createdAt:        settlements.createdAt,
      updatedAt:        settlements.updatedAt,
      createdBy:        settlements.createdBy,
    })
    .from(settlements)
    .innerJoin(consignors, eq(consignors.id, settlements.consignorId))
    .innerJoin(auctions, eq(auctions.id, settlements.auctionId))
    .where(eq(settlements.id, id))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select({
      id:               settlementItems.id,
      settlementId:     settlementItems.settlementId,
      lotId:            settlementItems.lotId,
      lotNumber:        lots.lotNumber,
      lotTitle:         lots.title,
      lotArtist:        lots.artist,
      hammerPrice:      settlementItems.hammerPrice,
      commissionRate:   settlementItems.commissionRate,
      commissionAmount: settlementItems.commissionAmount,
    })
    .from(settlementItems)
    .innerJoin(lots, eq(lots.id, settlementItems.lotId))
    .where(eq(settlementItems.settlementId, id))
    .orderBy(lots.lotNumber);

  return { ...row, items };
}

// ─── Generate settlement for consignor + auction ──────────────────────────────

export async function generateSettlement(data: CreateSettlementData) {
  const { consignorId, auctionId, createdBy } = data;

  // Check no existing settlement for this consignor+auction
  const [existing] = await db
    .select({ id: settlements.id })
    .from(settlements)
    .where(and(eq(settlements.consignorId, consignorId), eq(settlements.auctionId, auctionId)))
    .limit(1);

  if (existing) {
    throw new Error('Settlement already exists for this consignor and auction');
  }

  // Get consignor commission rate
  const [consignor] = await db
    .select({ commissionRate: consignors.commissionRate })
    .from(consignors)
    .where(eq(consignors.id, consignorId))
    .limit(1);

  if (!consignor) throw new Error('Consignor not found');

  const commissionRate = parseFloat(consignor.commissionRate ?? '0.1');

  // Find all sold lots for this consignor in this auction
  const soldLots = await db
    .select({
      id:          lots.id,
      lotNumber:   lots.lotNumber,
      hammerPrice: lots.hammerPrice,
    })
    .from(lots)
    .where(
      and(
        eq(lots.consignorId, consignorId),
        eq(lots.auctionId, auctionId),
        eq(lots.status, 'sold'),
      ),
    );

  if (soldLots.length === 0) {
    throw new Error('No sold lots found for this consignor in this auction');
  }

  // Calculate totals
  let totalHammer = 0;
  let totalCommission = 0;

  const itemsToInsert = soldLots.map((lot) => {
    const hammer = lot.hammerPrice ?? 0;
    const commission = Math.round(hammer * commissionRate);
    totalHammer += hammer;
    totalCommission += commission;
    return {
      lotId: lot.id,
      hammerPrice: hammer,
      commissionRate: commissionRate.toFixed(4),
      commissionAmount: commission,
    };
  });

  const netPayout = totalHammer - totalCommission;

  // Insert settlement
  const [settlement] = await db
    .insert(settlements)
    .values({
      consignorId,
      auctionId,
      totalHammer,
      commissionAmount: totalCommission,
      netPayout,
      status: 'pending',
      createdBy,
    })
    .returning();

  // Insert items
  await db.insert(settlementItems).values(
    itemsToInsert.map((item) => ({
      settlementId: settlement.id,
      ...item,
    })),
  );

  return settlement;
}

// ─── Update settlement status ─────────────────────────────────────────────────

export async function updateSettlementStatus(
  id: string,
  status: 'pending' | 'approved' | 'paid',
  bankReference?: string | null,
  notes?: string | null,
) {
  const updateValues: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'paid') {
    updateValues.paidAt = new Date();
  }

  if (bankReference !== undefined) {
    updateValues.bankReference = bankReference;
  }

  if (notes !== undefined) {
    updateValues.notes = notes;
  }

  const [updated] = await db
    .update(settlements)
    .set(updateValues)
    .where(eq(settlements.id, id))
    .returning();

  return updated;
}
