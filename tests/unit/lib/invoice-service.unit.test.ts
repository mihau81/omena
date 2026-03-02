import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── We test the status transition matrix which is embedded in updateInvoiceStatus.
// We mock the DB to control what "current status" is returned.

let mockCurrentStatus: string | null = 'pending';
let mockUpdatedRow = { id: 'inv-1', status: 'sent' };

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      if (mockCurrentStatus === null) return Promise.resolve([]);
      return Promise.resolve([{ status: mockCurrentStatus }]);
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => Promise.resolve([mockUpdatedRow])),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/db/schema', () => ({
  invoices: { id: 'id', status: 'status', lotId: 'lotId' },
  lots: {},
  auctions: {},
  users: {},
}));

vi.mock('@/db/queries/premium', () => ({
  getTiersForAuction: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/premium', () => ({
  calculatePremium: vi.fn().mockReturnValue({ premium: 1000 }),
  calculateFlatPremium: vi.fn().mockReturnValue({ premium: 2000 }),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args) => args),
  sql: vi.fn(),
  desc: vi.fn(),
}));

import { updateInvoiceStatus } from '@/lib/invoice-service';

// Helper to set the mock DB to return a specific current status
function setCurrentStatus(status: string | null) {
  mockCurrentStatus = status;
}

describe('updateInvoiceStatus — status transition matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatedRow = { id: 'inv-1', status: 'sent' };
  });

  describe('pending transitions', () => {
    it('allows pending → sent', async () => {
      setCurrentStatus('pending');
      mockUpdatedRow = { id: 'inv-1', status: 'sent' };
      await expect(updateInvoiceStatus('inv-1', 'sent')).resolves.toBeDefined();
    });

    it('allows pending → cancelled', async () => {
      setCurrentStatus('pending');
      mockUpdatedRow = { id: 'inv-1', status: 'cancelled' };
      await expect(updateInvoiceStatus('inv-1', 'cancelled')).resolves.toBeDefined();
    });

    it('rejects pending → paid', async () => {
      setCurrentStatus('pending');
      await expect(updateInvoiceStatus('inv-1', 'paid')).rejects.toThrow(
        "Cannot transition invoice from 'pending' to 'paid'"
      );
    });

    it('rejects pending → overdue', async () => {
      setCurrentStatus('pending');
      await expect(updateInvoiceStatus('inv-1', 'overdue')).rejects.toThrow(/pending/);
    });
  });

  describe('sent transitions', () => {
    it('allows sent → paid', async () => {
      setCurrentStatus('sent');
      mockUpdatedRow = { id: 'inv-1', status: 'paid', paidAt: new Date() };
      await expect(updateInvoiceStatus('inv-1', 'paid')).resolves.toBeDefined();
    });

    it('allows sent → overdue', async () => {
      setCurrentStatus('sent');
      mockUpdatedRow = { id: 'inv-1', status: 'overdue' };
      await expect(updateInvoiceStatus('inv-1', 'overdue')).resolves.toBeDefined();
    });

    it('allows sent → cancelled', async () => {
      setCurrentStatus('sent');
      mockUpdatedRow = { id: 'inv-1', status: 'cancelled' };
      await expect(updateInvoiceStatus('inv-1', 'cancelled')).resolves.toBeDefined();
    });

    it('rejects sent → pending', async () => {
      setCurrentStatus('sent');
      await expect(updateInvoiceStatus('inv-1', 'pending')).rejects.toThrow(/sent/);
    });
  });

  describe('overdue transitions', () => {
    it('allows overdue → paid', async () => {
      setCurrentStatus('overdue');
      mockUpdatedRow = { id: 'inv-1', status: 'paid', paidAt: new Date() };
      await expect(updateInvoiceStatus('inv-1', 'paid')).resolves.toBeDefined();
    });

    it('allows overdue → cancelled', async () => {
      setCurrentStatus('overdue');
      mockUpdatedRow = { id: 'inv-1', status: 'cancelled' };
      await expect(updateInvoiceStatus('inv-1', 'cancelled')).resolves.toBeDefined();
    });

    it('rejects overdue → sent', async () => {
      setCurrentStatus('overdue');
      await expect(updateInvoiceStatus('inv-1', 'sent')).rejects.toThrow(/overdue/);
    });
  });

  describe('paid transitions (terminal)', () => {
    it('rejects paid → any status', async () => {
      setCurrentStatus('paid');
      await expect(updateInvoiceStatus('inv-1', 'cancelled')).rejects.toThrow(/paid/);
      await expect(updateInvoiceStatus('inv-1', 'pending')).rejects.toThrow(/paid/);
      await expect(updateInvoiceStatus('inv-1', 'sent')).rejects.toThrow(/paid/);
    });
  });

  describe('cancelled transitions (terminal)', () => {
    it('rejects cancelled → any status', async () => {
      setCurrentStatus('cancelled');
      await expect(updateInvoiceStatus('inv-1', 'paid')).rejects.toThrow(/cancelled/);
      await expect(updateInvoiceStatus('inv-1', 'pending')).rejects.toThrow(/cancelled/);
    });
  });

  describe('invoice not found', () => {
    it('throws when invoice does not exist', async () => {
      setCurrentStatus(null);
      await expect(updateInvoiceStatus('non-existent', 'sent')).rejects.toThrow(
        'Invoice non-existent not found'
      );
    });
  });
});
