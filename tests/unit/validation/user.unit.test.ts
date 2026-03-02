import { describe, it, expect } from 'vitest';
import {
  registerUserSchema,
  loginSchema,
  updateProfileSchema,
  magicLinkRequestSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  changePasswordSchema,
  registerQrSchema,
  registerInvitationSchema,
  sendInvitationSchema,
  rejectUserSchema,
} from '@/lib/validation/user';

// ─── registerUserSchema ─────────────────────────────────────────────────────

describe('registerUserSchema', () => {
  it('accepts valid registration with password', () => {
    const result = registerUserSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      password: 'securepass123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts registration without password (optional)', () => {
    const result = registerUserSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
    });
    expect(result.success).toBe(true);
  });

  it('accepts registration with phone', () => {
    const result = registerUserSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      phone: '+48 123 456 789',
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

  describe('phone validation', () => {
    it('rejects phone longer than 30 chars', () => {
      const result = registerUserSchema.safeParse({
        email: 'user@example.com',
        name: 'Jan Nowak',
        phone: 'a'.repeat(31),
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── loginSchema ─────────────────────────────────────────────────────────────

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

// ─── updateProfileSchema ─────────────────────────────────────────────────────

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

// ─── magicLinkRequestSchema ──────────────────────────────────────────────────

describe('magicLinkRequestSchema', () => {
  it('accepts valid email', () => {
    const result = magicLinkRequestSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = magicLinkRequestSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = magicLinkRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects email exceeding max length', () => {
    const result = magicLinkRequestSchema.safeParse({ email: 'a'.repeat(310) + '@example.com' });
    expect(result.success).toBe(false);
  });
});

// ─── passwordResetRequestSchema ──────────────────────────────────────────────

describe('passwordResetRequestSchema', () => {
  it('accepts valid email', () => {
    const result = passwordResetRequestSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = passwordResetRequestSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = passwordResetRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── passwordResetConfirmSchema ──────────────────────────────────────────────

describe('passwordResetConfirmSchema', () => {
  it('accepts valid token and password', () => {
    const result = passwordResetConfirmSchema.safeParse({
      token: 'abc123def456',
      newPassword: 'NewSecurePass123!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty token', () => {
    const result = passwordResetConfirmSchema.safeParse({
      token: '',
      newPassword: 'NewSecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing token', () => {
    const result = passwordResetConfirmSchema.safeParse({
      newPassword: 'NewSecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = passwordResetConfirmSchema.safeParse({
      token: 'abc123',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('accepts password of exactly 8 characters', () => {
    const result = passwordResetConfirmSchema.safeParse({
      token: 'abc123',
      newPassword: '12345678',
    });
    expect(result.success).toBe(true);
  });
});

// ─── changePasswordSchema ────────────────────────────────────────────────────

describe('changePasswordSchema', () => {
  it('accepts new password without current (for magic link users)', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'NewSecurePass123!',
    });
    expect(result.success).toBe(true);
  });

  it('accepts both current and new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword123!',
      newPassword: 'NewSecurePass123!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects new password shorter than 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing new password', () => {
    const result = changePasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── registerQrSchema ────────────────────────────────────────────────────────

describe('registerQrSchema', () => {
  it('accepts valid registration with QR code', () => {
    const result = registerQrSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      qrCode: 'GALA-WIOSNA-2026',
    });
    expect(result.success).toBe(true);
  });

  it('accepts QR registration with password and phone', () => {
    const result = registerQrSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      password: 'securepass123',
      phone: '+48 123 456 789',
      qrCode: 'GALA-WIOSNA-2026',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing QR code', () => {
    const result = registerQrSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty QR code', () => {
    const result = registerQrSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      qrCode: '',
    });
    expect(result.success).toBe(false);
  });

  it('inherits email/name validation from registerUserSchema', () => {
    const result = registerQrSchema.safeParse({
      email: 'not-an-email',
      name: 'Jan Nowak',
      qrCode: 'ABC',
    });
    expect(result.success).toBe(false);
  });
});

// ─── registerInvitationSchema ────────────────────────────────────────────────

describe('registerInvitationSchema', () => {
  it('accepts valid registration with invitation token', () => {
    const result = registerInvitationSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      invitationToken: 'some-long-token-hex',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing invitation token', () => {
    const result = registerInvitationSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty invitation token', () => {
    const result = registerInvitationSchema.safeParse({
      email: 'user@example.com',
      name: 'Jan Nowak',
      invitationToken: '',
    });
    expect(result.success).toBe(false);
  });
});

// ─── sendInvitationSchema ────────────────────────────────────────────────────

describe('sendInvitationSchema', () => {
  it('accepts valid email', () => {
    const result = sendInvitationSchema.safeParse({ email: 'friend@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = sendInvitationSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = sendInvitationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── rejectUserSchema ────────────────────────────────────────────────────────

describe('rejectUserSchema', () => {
  it('accepts with reason', () => {
    const result = rejectUserSchema.safeParse({ reason: 'Incomplete application' });
    expect(result.success).toBe(true);
  });

  it('accepts without reason (optional)', () => {
    const result = rejectUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = rejectUserSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeUndefined();
    }
  });
});
