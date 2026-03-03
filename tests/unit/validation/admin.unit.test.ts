import { describe, it, expect } from 'vitest';
import { createAdminSchema, updateAdminSchema, changePasswordSchema } from '@/lib/validation/admin';

describe('createAdminSchema', () => {
  const VALID_ADMIN = {
    email: 'admin@omenaa.pl',
    name: 'Jan Nowak',
    password: 'securepassword123',
  };

  it('accepts valid admin data', () => {
    const result = createAdminSchema.safeParse(VALID_ADMIN);
    expect(result.success).toBe(true);
  });

  describe('email validation', () => {
    it('rejects missing email', () => {
      const { email: _e, ...rest } = VALID_ADMIN;
      const result = createAdminSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, email: 'not-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('name validation', () => {
    it('rejects missing name', () => {
      const { name: _n, ...rest } = VALID_ADMIN;
      const result = createAdminSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('password validation', () => {
    it('rejects password shorter than 8 chars', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, password: 'short' });
      expect(result.success).toBe(false);
    });

    it('accepts password of exactly 8 chars', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, password: '12345678' });
      expect(result.success).toBe(true);
    });

    it('rejects password over 100 chars', () => {
      const result = createAdminSchema.safeParse({
        ...VALID_ADMIN,
        password: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('role', () => {
    it('defaults role to "viewer"', () => {
      const result = createAdminSchema.parse(VALID_ADMIN);
      expect(result.role).toBe('viewer');
    });

    it('accepts super_admin role', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, role: 'super_admin' });
      expect(result.success).toBe(true);
    });

    it('accepts admin role', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, role: 'admin' });
      expect(result.success).toBe(true);
    });

    it('accepts cataloguer role', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, role: 'cataloguer' });
      expect(result.success).toBe(true);
    });

    it('accepts auctioneer role', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, role: 'auctioneer' });
      expect(result.success).toBe(true);
    });

    it('accepts viewer role explicitly', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, role: 'viewer' });
      expect(result.success).toBe(true);
    });

    it('rejects unknown role', () => {
      const result = createAdminSchema.safeParse({ ...VALID_ADMIN, role: 'guest' });
      expect(result.success).toBe(false);
    });
  });
});

describe('updateAdminSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = updateAdminSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with name only', () => {
    const result = updateAdminSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts isActive boolean', () => {
    const result = updateAdminSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('accepts valid role', () => {
    const result = updateAdminSchema.safeParse({ role: 'cataloguer' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = updateAdminSchema.safeParse({ role: 'superuser' });
    expect(result.success).toBe(false);
  });

  it('validates password min length when provided', () => {
    const result = updateAdminSchema.safeParse({ password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid password change', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty currentPassword', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'newpassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects newPassword shorter than 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpassword',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects newPassword over 100 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpassword',
      newPassword: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing currentPassword', () => {
    const result = changePasswordSchema.safeParse({ newPassword: 'newpassword123' });
    expect(result.success).toBe(false);
  });
});
