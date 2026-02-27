import { eq, and, or, ilike, desc, count, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../connection';
import { consignors, lots, auctions } from '../schema';
import { notDeleted } from '../helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListConsignorsFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateConsignorData {
  name: string;
  email?: string | null;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  companyName?: string;
  taxId?: string;
  commissionRate?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateConsignorData = Partial<CreateConsignorData>;

// ─── List Consignors (paginated + filtered) ──────────────────────────────────

export async function getConsignors(filters: ListConsignorsFilters = {}) {
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [notDeleted(consignors)];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(consignors.name, pattern),
        ilike(consignors.email, pattern),
        ilike(consignors.companyName, pattern),
        ilike(consignors.taxId, pattern),
      )!,
    );
  }

  if (filters.isActive !== undefined) {
    conditions.push(eq(consignors.isActive, filters.isActive));
  }

  const whereClause = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: consignors.id,
        name: consignors.name,
        email: consignors.email,
        phone: consignors.phone,
        companyName: consignors.companyName,
        taxId: consignors.taxId,
        commissionRate: consignors.commissionRate,
        isActive: consignors.isActive,
        createdAt: consignors.createdAt,
        lotCount: count(lots.id),
      })
      .from(consignors)
      .leftJoin(lots, and(eq(lots.consignorId, consignors.id), isNull(lots.deletedAt)))
      .where(whereClause)
      .groupBy(consignors.id)
      .orderBy(desc(consignors.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(consignors)
      .where(whereClause),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

// ─── Single Consignor with lot count ────────────────────────────────────────

export async function getConsignorById(id: string) {
  const [row] = await db
    .select()
    .from(consignors)
    .where(and(eq(consignors.id, id), notDeleted(consignors)))
    .limit(1);

  if (!row) return null;

  const [lotCountResult] = await db
    .select({ total: count() })
    .from(lots)
    .where(and(eq(lots.consignorId, id), isNull(lots.deletedAt)));

  const [soldCountResult] = await db
    .select({ total: count() })
    .from(lots)
    .where(and(eq(lots.consignorId, id), isNull(lots.deletedAt), eq(lots.status, 'sold')));

  return {
    ...row,
    lotCount: lotCountResult.total,
    soldLotCount: soldCountResult.total,
  };
}

// ─── Lots by Consignor (with auction info + sale status) ────────────────────

export async function getConsignorLots(consignorId: string) {
  const rows = await db
    .select({
      lotId: lots.id,
      lotNumber: lots.lotNumber,
      title: lots.title,
      artist: lots.artist,
      status: lots.status,
      estimateMin: lots.estimateMin,
      estimateMax: lots.estimateMax,
      hammerPrice: lots.hammerPrice,
      auctionId: lots.auctionId,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
      createdAt: lots.createdAt,
    })
    .from(lots)
    .innerJoin(auctions, eq(auctions.id, lots.auctionId))
    .where(and(eq(lots.consignorId, consignorId), isNull(lots.deletedAt)))
    .orderBy(desc(lots.createdAt));

  return rows;
}

// ─── Create Consignor ────────────────────────────────────────────────────────

export async function createConsignor(data: CreateConsignorData) {
  const [created] = await db
    .insert(consignors)
    .values({
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      postalCode: data.postalCode ?? '',
      country: data.country ?? 'Poland',
      companyName: data.companyName ?? '',
      taxId: data.taxId ?? '',
      commissionRate: data.commissionRate ?? '0.1000',
      notes: data.notes ?? '',
      isActive: data.isActive ?? true,
    })
    .returning();

  return created;
}

// ─── Update Consignor ────────────────────────────────────────────────────────

export async function updateConsignor(id: string, data: UpdateConsignorData) {
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateValues.name = data.name;
  if (data.email !== undefined) updateValues.email = data.email;
  if (data.phone !== undefined) updateValues.phone = data.phone;
  if (data.address !== undefined) updateValues.address = data.address;
  if (data.city !== undefined) updateValues.city = data.city;
  if (data.postalCode !== undefined) updateValues.postalCode = data.postalCode;
  if (data.country !== undefined) updateValues.country = data.country;
  if (data.companyName !== undefined) updateValues.companyName = data.companyName;
  if (data.taxId !== undefined) updateValues.taxId = data.taxId;
  if (data.commissionRate !== undefined) updateValues.commissionRate = data.commissionRate;
  if (data.notes !== undefined) updateValues.notes = data.notes;
  if (data.isActive !== undefined) updateValues.isActive = data.isActive;

  const [updated] = await db
    .update(consignors)
    .set(updateValues)
    .where(eq(consignors.id, id))
    .returning();

  return updated;
}

// ─── Soft-delete Consignor ───────────────────────────────────────────────────

export async function deleteConsignor(id: string) {
  const [deleted] = await db
    .update(consignors)
    .set({
      deletedAt: new Date(),
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(consignors.id, id))
    .returning();

  return deleted;
}

// ─── List all active consignors (for dropdown selector) ─────────────────────

export async function listActiveConsignors() {
  return db
    .select({
      id: consignors.id,
      name: consignors.name,
      companyName: consignors.companyName,
    })
    .from(consignors)
    .where(and(notDeleted(consignors), eq(consignors.isActive, true)))
    .orderBy(consignors.name);
}
