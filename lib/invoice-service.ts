import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { invoices, lots, auctions, users } from '@/db/schema';
import { getTiersForAuction } from '@/db/queries/premium';
import { calculatePremium, calculateFlatPremium } from '@/lib/premium';

export type InvoiceStatus = 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceWithDetails {
  id: string;
  invoiceNumber: string;
  userId: string;
  auctionId: string;
  lotId: string;
  hammerPrice: number;
  buyersPremium: number;
  totalAmount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  userName: string;
  userEmail: string;
  userAddress: string | null;
  userCity: string | null;
  userPostalCode: string | null;
  userCountry: string | null;
  lotTitle: string;
  lotNumber: number;
  auctionTitle: string;
  auctionSlug: string;
}

// ─── Invoice number generation ─────────────────────────────────────────────

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OMENA/${year}/`;

  // Count invoices created this year to determine the next sequence number
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(sql`invoice_number LIKE ${prefix + '%'}`);

  const count = result[0]?.count ?? 0;
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// ─── Generate invoice for a sold lot ───────────────────────────────────────

export async function generateInvoice(lotId: string): Promise<typeof invoices.$inferSelect> {
  // Fetch lot with auction info
  const [lotRow] = await db
    .select({
      lot: lots,
      auction: auctions,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(eq(lots.id, lotId))
    .limit(1);

  if (!lotRow) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const { lot, auction } = lotRow;

  if (lot.status !== 'sold') {
    throw new Error(`Lot ${lotId} is not sold (status: ${lot.status})`);
  }

  if (!lot.hammerPrice) {
    throw new Error(`Lot ${lotId} has no hammer price`);
  }

  // Find the winning bidder
  const { bids, bidRegistrations } = await import('@/db/schema');
  const [winningBid] = await db
    .select({ userId: bids.userId, registrationId: bids.registrationId })
    .from(bids)
    .where(and(eq(bids.lotId, lotId), eq(bids.isWinning, true)))
    .limit(1);

  let buyerId: string | null = winningBid?.userId ?? null;

  // If bid has no direct userId, try to get it from registration
  if (!buyerId && winningBid?.registrationId) {
    const [reg] = await db
      .select({ userId: bidRegistrations.userId })
      .from(bidRegistrations)
      .where(eq(bidRegistrations.id, winningBid.registrationId))
      .limit(1);
    buyerId = reg?.userId ?? null;
  }

  if (!buyerId) {
    throw new Error(`No winning bidder found for lot ${lotId}`);
  }

  // Check for existing invoice
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.lotId, lotId))
    .limit(1);

  if (existing) {
    throw new Error(`Invoice already exists for lot ${lotId}`);
  }

  // Calculate buyer's premium — use tiered schedule if configured, else flat rate
  const hammerPrice = lot.hammerPrice;
  const tiers = await getTiersForAuction(auction.id);

  let buyersPremium: number;
  if (tiers.length > 0) {
    const result = calculatePremium(hammerPrice, tiers);
    buyersPremium = result.premium;
  } else {
    const flatRate = auction.buyersPremiumRate
      ? parseFloat(String(auction.buyersPremiumRate))
      : 0.20;
    const result = calculateFlatPremium(hammerPrice, flatRate);
    buyersPremium = result.premium;
  }

  const totalAmount = hammerPrice + buyersPremium;

  // Due date: 14 days from now
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const invoiceNumber = await generateInvoiceNumber();

  const [created] = await db.insert(invoices).values({
    invoiceNumber,
    userId: buyerId,
    auctionId: auction.id,
    lotId: lot.id,
    hammerPrice,
    buyersPremium,
    totalAmount,
    currency: 'PLN',
    status: 'pending',
    dueDate,
  }).returning();

  return created;
}

// ─── Fetch single invoice with details ─────────────────────────────────────

export async function getInvoice(id: string): Promise<InvoiceWithDetails | null> {
  const rows = await db
    .select({
      invoice: invoices,
      userName: users.name,
      userEmail: users.email,
      userAddress: users.address,
      userCity: users.city,
      userPostalCode: users.postalCode,
      userCountry: users.country,
      lotTitle: lots.title,
      lotNumber: lots.lotNumber,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
    })
    .from(invoices)
    .innerJoin(users, eq(invoices.userId, users.id))
    .innerJoin(lots, eq(invoices.lotId, lots.id))
    .innerJoin(auctions, eq(invoices.auctionId, auctions.id))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!rows.length) return null;

  const r = rows[0];
  return {
    ...r.invoice,
    createdAt: r.invoice.createdAt.toISOString(),
    updatedAt: r.invoice.updatedAt.toISOString(),
    dueDate: r.invoice.dueDate?.toISOString() ?? null,
    paidAt: r.invoice.paidAt?.toISOString() ?? null,
    userName: r.userName,
    userEmail: r.userEmail,
    userAddress: r.userAddress ?? null,
    userCity: r.userCity ?? null,
    userPostalCode: r.userPostalCode ?? null,
    userCountry: r.userCountry ?? null,
    lotTitle: r.lotTitle,
    lotNumber: r.lotNumber,
    auctionTitle: r.auctionTitle,
    auctionSlug: r.auctionSlug,
  };
}

// ─── List invoices with optional filters ───────────────────────────────────

export async function listInvoices(filters?: {
  status?: string;
  auctionId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<InvoiceWithDetails[]> {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(invoices.status, filters.status));
  }
  if (filters?.auctionId) {
    conditions.push(eq(invoices.auctionId, filters.auctionId));
  }
  if (filters?.userId) {
    conditions.push(eq(invoices.userId, filters.userId));
  }

  const query = db
    .select({
      invoice: invoices,
      userName: users.name,
      userEmail: users.email,
      userAddress: users.address,
      userCity: users.city,
      userPostalCode: users.postalCode,
      userCountry: users.country,
      lotTitle: lots.title,
      lotNumber: lots.lotNumber,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
    })
    .from(invoices)
    .innerJoin(users, eq(invoices.userId, users.id))
    .innerJoin(lots, eq(invoices.lotId, lots.id))
    .innerJoin(auctions, eq(invoices.auctionId, auctions.id))
    .orderBy(desc(invoices.createdAt))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);

  const rows = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return rows.map((r) => ({
    ...r.invoice,
    createdAt: r.invoice.createdAt.toISOString(),
    updatedAt: r.invoice.updatedAt.toISOString(),
    dueDate: r.invoice.dueDate?.toISOString() ?? null,
    paidAt: r.invoice.paidAt?.toISOString() ?? null,
    userName: r.userName,
    userEmail: r.userEmail,
    userAddress: r.userAddress ?? null,
    userCity: r.userCity ?? null,
    userPostalCode: r.userPostalCode ?? null,
    userCountry: r.userCountry ?? null,
    lotTitle: r.lotTitle,
    lotNumber: r.lotNumber,
    auctionTitle: r.auctionTitle,
    auctionSlug: r.auctionSlug,
  }));
}

// ─── Update invoice status ──────────────────────────────────────────────────

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

export async function updateInvoiceStatus(
  id: string,
  newStatus: InvoiceStatus,
): Promise<typeof invoices.$inferSelect> {
  const [current] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!current) {
    throw new Error(`Invoice ${id} not found`);
  }

  const allowed = VALID_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition invoice from '${current.status}' to '${newStatus}'`,
    );
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === 'paid') {
    updateData.paidAt = new Date();
  }

  const [updated] = await db
    .update(invoices)
    .set(updateData)
    .where(eq(invoices.id, id))
    .returning();

  return updated;
}
