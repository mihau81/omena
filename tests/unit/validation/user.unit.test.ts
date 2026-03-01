import { describe, it, expect } from 'vitest';
import { registerUserSchema, loginSchema, updateProfileSchema } from '@/lib/validation/user';

describe('registerUserSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerUserSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      password: 'securepass123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts registration with password', () => {
    const result = registerUserSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      password: 'securepassword',
    });
    expect(result.success).toBe(true);
  });

  describe('email validation', () => {
    it('rejects missing email', () => {
      const result = registerUserSchema.safeParse({ name: 'Jan Nowak' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = registerUserSchema.safeParse({
        email: 'not-an-email',
        name: 'Jan Nowak',
      });
      expect(result.success).toBe(false);
    });

    it('rejects email without domain', () => {
      const result = registerUserSchema.safeParse({
        email: 'user@',
        name: 'Jan Nowak',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('password validation', () => {
    it('rejects password shorter than 8 characters', () => {
      const result = registerUserSchema.safeParse({
        email: 'user@example.com',
        name: 'Jan Nowak',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('accepts password of exactly 8 characters', () => {
      const result = registerUserSchema.safeParse({
        email: 'user@example.com',
        name: 'Jan Nowak',
        password: '12345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects omitted password (required)', () => {
      const result = registerUserSchema.safeParse({
        email: 'user@example.com',
        name: 'Jan Nowak',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('name validation', () => {
    it('rejects missing name', () => {
      const result = registerUserSchema.safeParse({ email: 'user@example.com' });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = registerUserSchema.safeParse({
        email: 'user@example.com',
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'anypassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'anypassword' });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with name only', () => {
    const result = updateProfileSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with phone', () => {
    const result = updateProfileSchema.safeParse({ phone: '+48 123 456 789' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name when provided', () => {
    const result = updateProfileSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts full profile update', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Jan Nowak',
      phone: '+48 123 456 789',
      address: 'ul. Testowa 1',
      city: 'Warsaw',
      postalCode: '00-001',
      country: 'Poland',
    });
    expect(result.success).toBe(true);
  });
});
