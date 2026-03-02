import { randomUUID } from 'crypto';

// ─── Auction fixtures ─────────────────────────────────────────────────────────

export type AuctionFixture = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  startDate: Date;
  endDate: Date;
  location: string;
  curator: string;
  status: 'draft' | 'preview' | 'live' | 'reconciliation' | 'archive';
  visibilityLevel: '0' | '1' | '2';
  sortOrder: number;
  buyersPremiumRate: string;
};

export function createAuction(overrides: Partial<AuctionFixture> = {}): AuctionFixture {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  return {
    id: randomUUID(),
    slug: `test-auction-${Date.now()}`,
    title: 'Test Auction',
    description: 'A test auction for automated testing',
    category: 'mixed',
    startDate: future,
    endDate: new Date(future.getTime() + 4 * 60 * 60 * 1000), // +4h from start
    location: 'Warsaw, Poland',
    curator: 'Test Curator',
    status: 'draft',
    visibilityLevel: '0',
    sortOrder: 0,
    buyersPremiumRate: '0.2000',
    ...overrides,
  };
}

// ─── Lot fixtures ─────────────────────────────────────────────────────────────

export type LotFixture = {
  id: string;
  auctionId: string;
  lotNumber: number;
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: number | null;
  estimateMin: number;
  estimateMax: number;
  reservePrice: number | null;
  startingBid: number | null;
  hammerPrice: number | null;
  status: 'draft' | 'catalogued' | 'published' | 'active' | 'sold' | 'passed' | 'withdrawn';
  sortOrder: number;
};

export function createLot(overrides: Partial<LotFixture> = {}): LotFixture {
  return {
    id: randomUUID(),
    auctionId: randomUUID(),
    lotNumber: Math.floor(Math.random() * 900) + 1,
    title: 'Test Artwork',
    artist: 'Test Artist',
    description: 'Oil on canvas, test piece',
    medium: 'Oil on canvas',
    dimensions: '50 x 70 cm',
    year: 2020,
    estimateMin: 5000,
    estimateMax: 8000,
    reservePrice: null,
    startingBid: null,
    hammerPrice: null,
    status: 'draft',
    sortOrder: 0,
    ...overrides,
  };
}

// ─── Bid fixtures ─────────────────────────────────────────────────────────────

export type BidFixture = {
  id: string;
  lotId: string;
  userId: string | null;
  amount: number;
  bidType: 'online' | 'phone' | 'floor' | 'absentee' | 'system';
  paddleNumber: number | null;
  isWinning: boolean;
};

export function createBid(overrides: Partial<BidFixture> = {}): BidFixture {
  return {
    id: randomUUID(),
    lotId: randomUUID(),
    userId: randomUUID(),
    amount: 5000,
    bidType: 'online',
    paddleNumber: null,
    isWinning: false,
    ...overrides,
  };
}

// ─── Invoice fixtures ─────────────────────────────────────────────────────────

export type InvoiceFixture = {
  id: string;
  userId: string;
  auctionId: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  stripePaymentIntentId: string | null;
};

export function createInvoice(overrides: Partial<InvoiceFixture> = {}): InvoiceFixture {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    auctionId: randomUUID(),
    totalAmount: 10000,
    status: 'pending',
    stripePaymentIntentId: null,
    ...overrides,
  };
}

// ─── Consignor fixtures ───────────────────────────────────────────────────────

export type ConsignorFixture = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  companyName: string;
  taxId: string;
  commissionRate: string;
  isActive: boolean;
};

export function createConsignor(overrides: Partial<ConsignorFixture> = {}): ConsignorFixture {
  return {
    id: randomUUID(),
    name: 'Test Consignor',
    email: 'consignor@example.com',
    phone: '+48 123 456 789',
    address: 'ul. Testowa 1',
    city: 'Warsaw',
    postalCode: '00-001',
    country: 'Poland',
    companyName: 'Test Company Sp. z o.o.',
    taxId: '1234567890',
    commissionRate: '0.1000',
    isActive: true,
    ...overrides,
  };
}

// ─── API Key fixtures ─────────────────────────────────────────────────────────

export type ApiKeyFixture = {
  id: string;
  name: string;
  keyHash: string;
  createdBy: string;
  expiresAt: Date | null;
  isActive: boolean;
};

export function createApiKey(overrides: Partial<ApiKeyFixture> = {}): ApiKeyFixture {
  return {
    id: randomUUID(),
    name: 'Test API Key',
    keyHash: 'hashed_test_key_value',
    createdBy: randomUUID(),
    expiresAt: null,
    isActive: true,
    ...overrides,
  };
}
