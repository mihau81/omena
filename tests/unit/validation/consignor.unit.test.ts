import { describe, it, expect } from 'vitest';
import { createConsignorSchema, updateConsignorSchema } from '@/lib/validation/consignor';

describe('createConsignorSchema', () => {
  const VALID_CONSIGNOR = {
    name: 'Jan Nowak',
    email: 'jan.nowak@example.com',
  };

  it('accepts valid consignor', () => {
    const result = createConsignorSchema.safeParse(VALID_CONSIGNOR);
    expect(result.success).toBe(true);
  });

  describe('name validation', () => {
    it('rejects missing name', () => {
      const result = createConsignorSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createConsignorSchema.safeParse({ ...VALID_CONSIGNOR, name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('email validation', () => {
    it('accepts null email', () => {
      const result = createConsignorSchema.safeParse({ ...VALID_CONSIGNOR, email: null });
      expect(result.success).toBe(true);
    });

    it('accepts missing email (optional)', () => {
      const result = createConsignorSchema.safeParse({ name: 'Jan Nowak' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const result = createConsignorSchema.safeParse({ ...VALID_CONSIGNOR, email: 'not-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('commissionRate', () => {
    it('defaults to "0.1000"', () => {
      const result = createConsignorSchema.parse(VALID_CONSIGNOR);
      expect(result.commissionRate).toBe('0.1000');
    });

    it('accepts valid commission rate "0.1500"', () => {
      const result = createConsignorSchema.safeParse({
        ...VALID_CONSIGNOR,
        commissionRate: '0.1500',
      });
      expect(result.success).toBe(true);
    });

    it('accepts "0" (zero commission)', () => {
      const result = createConsignorSchema.safeParse({
        ...VALID_CONSIGNOR,
        commissionRate: '0',
      });
      expect(result.success).toBe(true);
    });

    it('accepts "100" (100% commission rate)', () => {
      const result = createConsignorSchema.safeParse({
        ...VALID_CONSIGNOR,
        commissionRate: '100',
      });
      expect(result.success).toBe(true);
    });

    it('accepts integer string "15"', () => {
      const result = createConsignorSchema.safeParse({
        ...VALID_CONSIGNOR,
        commissionRate: '15',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-numeric commission rate', () => {
      const result = createConsignorSchema.safeParse({
        ...VALID_CONSIGNOR,
        commissionRate: 'twenty',
      });
      expect(result.success).toBe(false);
    });

    it('rejects commission rate with invalid format (too many decimals)', () => {
      const result = createConsignorSchema.safeParse({
        ...VALID_CONSIGNOR,
        commissionRate: '0.12345',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('defaults', () => {
    it('defaults country to "Poland"', () => {
      const result = createConsignorSchema.parse(VALID_CONSIGNOR);
      expect(result.country).toBe('Poland');
    });

    it('defaults isActive to true', () => {
      const result = createConsignorSchema.parse(VALID_CONSIGNOR);
      expect(result.isActive).toBe(true);
    });
  });
});

describe('updateConsignorSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = updateConsignorSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with name only', () => {
    const result = updateConsignorSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('validates commissionRate format when provided', () => {
    const result = updateConsignorSchema.safeParse({ commissionRate: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts valid commissionRate update', () => {
    const result = updateConsignorSchema.safeParse({ commissionRate: '0.2000' });
    expect(result.success).toBe(true);
  });
});
