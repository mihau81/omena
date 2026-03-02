import { describe, it, expect } from 'vitest';
import {
  placeBidSchema,
  adminPlaceBidSchema,
  retractBidSchema,
  createAbsenteeBidSchema,
} from '@/lib/validation/bid';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('placeBidSchema', () => {
  it('accepts valid bid', () => {
    const result = placeBidSchema.safeParse({ lotId: VALID_UUID, amount: 5000 });
    expect(result.success).toBe(true);
  });

  it('rejects missing lotId', () => {
    const result = placeBidSchema.safeParse({ amount: 5000 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid lotId (not UUID)', () => {
    const result = placeBidSchema.safeParse({ lotId: 'not-a-uuid', amount: 5000 });
    expect(result.success).toBe(false);
  });

  it('rejects missing amount', () => {
    const result = placeBidSchema.safeParse({ lotId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = placeBidSchema.safeParse({ lotId: VALID_UUID, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const result = placeBidSchema.safeParse({ lotId: VALID_UUID, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer amount', () => {
    const result = placeBidSchema.safeParse({ lotId: VALID_UUID, amount: 500.5 });
    expect(result.success).toBe(false);
  });

  it('rejects string amount', () => {
    const result = placeBidSchema.safeParse({ lotId: VALID_UUID, amount: '5000' });
    expect(result.success).toBe(false);
  });
});

describe('adminPlaceBidSchema', () => {
  it('accepts valid phone bid', () => {
    const result = adminPlaceBidSchema.safeParse({
      lotId: VALID_UUID,
      amount: 10000,
      bidType: 'phone',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid floor bid', () => {
    const result = adminPlaceBidSchema.safeParse({
      lotId: VALID_UUID,
      amount: 10000,
      bidType: 'floor',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional paddleNumber', () => {
    const result = adminPlaceBidSchema.safeParse({
      lotId: VALID_UUID,
      amount: 10000,
      bidType: 'floor',
      paddleNumber: 123,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid bidType (online)', () => {
    const result = adminPlaceBidSchema.safeParse({
      lotId: VALID_UUID,
      amount: 10000,
      bidType: 'online',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing bidType', () => {
    const result = adminPlaceBidSchema.safeParse({
      lotId: VALID_UUID,
      amount: 10000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive amount', () => {
    const result = adminPlaceBidSchema.safeParse({
      lotId: VALID_UUID,
      amount: -500,
      bidType: 'phone',
    });
    expect(result.success).toBe(false);
  });
});

describe('retractBidSchema', () => {
  it('accepts valid reason', () => {
    const result = retractBidSchema.safeParse({ reason: 'Bidder retracted' });
    expect(result.success).toBe(true);
  });

  it('rejects empty reason', () => {
    const result = retractBidSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing reason', () => {
    const result = retractBidSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('createAbsenteeBidSchema', () => {
  it('accepts valid absentee bid', () => {
    const result = createAbsenteeBidSchema.safeParse({
      lotId: VALID_UUID,
      maxAmount: 20000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing lotId', () => {
    const result = createAbsenteeBidSchema.safeParse({ maxAmount: 20000 });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive maxAmount', () => {
    const result = createAbsenteeBidSchema.safeParse({ lotId: VALID_UUID, maxAmount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxAmount', () => {
    const result = createAbsenteeBidSchema.safeParse({ lotId: VALID_UUID, maxAmount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer maxAmount', () => {
    const result = createAbsenteeBidSchema.safeParse({ lotId: VALID_UUID, maxAmount: 100.5 });
    expect(result.success).toBe(false);
  });
});
