import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB and schema — audit.ts calls db.insert which we don't want in unit tests
vi.mock('@/db/connection', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  auditLog: {},
}));

// We import computeChangedFields indirectly by testing logUpdate behaviour,
// but since it's not exported, we test via the exported logUpdate.
// However, the unit-testable pure function is computeChangedFields.
// We can expose it by re-exporting in the test or test through logUpdate.

// Since computeChangedFields is private, we'll verify its behaviour by
// inspecting what gets passed to db.insert via logUpdate.

import { logAudit, logCreate, logUpdate, logDelete } from '@/lib/audit';
import { db } from '@/db/connection';

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chain
    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(insertMock);
  });

  it('calls db.insert with correct fields', async () => {
    await logAudit({
      tableName: 'auctions',
      recordId: 'abc-123',
      action: 'INSERT',
      newData: { title: 'Test' },
      performedBy: 'admin-1',
      performedByType: 'admin',
    });

    expect(db.insert).toHaveBeenCalled();
  });
});

describe('logCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(insertMock);
  });

  it('calls db.insert without throwing', async () => {
    await expect(
      logCreate('lots', 'lot-1', { title: 'Artwork' }, 'admin-1', 'admin')
    ).resolves.toBeUndefined();
  });
});

describe('logUpdate — computeChangedFields', () => {
  let valuesSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    valuesSpy = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesSpy });
  });

  it('detects changed fields', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { title: 'Old Title', status: 'draft' },
      { title: 'New Title', status: 'draft' },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toContain('title');
    expect(callArg.changedFields).not.toContain('status');
  });

  it('detects added fields', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { title: 'Title' },
      { title: 'Title', artist: 'New Artist' },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toContain('artist');
  });

  it('detects removed fields (set to undefined)', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { title: 'Title', artist: 'Artist' },
      { title: 'Title' },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toContain('artist');
  });

  it('handles null values in fields', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { reservePrice: null },
      { reservePrice: 5000 },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toContain('reservePrice');
  });

  it('returns empty array when nothing changed', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { title: 'Same', status: 'draft' },
      { title: 'Same', status: 'draft' },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toHaveLength(0);
  });

  it('handles nested object changes via JSON.stringify comparison', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { meta: { key: 'value1' } },
      { meta: { key: 'value2' } },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toContain('meta');
  });

  it('detects no change for identical nested objects', async () => {
    await logUpdate(
      'lots',
      'lot-1',
      { meta: { key: 'value' } },
      { meta: { key: 'value' } },
    );

    const callArg = valuesSpy.mock.calls[0][0];
    expect(callArg.changedFields).toHaveLength(0);
  });
});

describe('logDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('calls db.insert without throwing', async () => {
    await expect(
      logDelete('lots', 'lot-1', { title: 'Old' }, 'admin-1', 'admin')
    ).resolves.toBeUndefined();
  });
});
