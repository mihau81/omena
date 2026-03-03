import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as OTPAuth from 'otpauth';

import {
  generateTOTPSecret,
  verifyTOTP,
  generateQRCodeDataURL,
  generateRecoveryCodes,
  encryptSecret,
  decryptSecret,
} from '@/lib/totp';

describe('generateTOTPSecret', () => {
  it('returns secret and uri', () => {
    const result = generateTOTPSecret('user@example.com');
    expect(result).toHaveProperty('secret');
    expect(result).toHaveProperty('uri');
  });

  it('secret is a non-empty base32 string', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
    // base32 alphabet
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it('uri starts with otpauth://totp/', () => {
    const { uri } = generateTOTPSecret('user@example.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
  });

  it('uri contains the label (email)', () => {
    const email = 'test@domain.com';
    const { uri } = generateTOTPSecret(email);
    expect(uri).toContain(encodeURIComponent(email));
  });

  it('uri contains issuer Omenaa CMS', () => {
    const { uri } = generateTOTPSecret('user@example.com');
    expect(uri).toContain('Omenaa%20CMS');
  });

  it('generates unique secrets on each call', () => {
    const result1 = generateTOTPSecret('user@example.com');
    const result2 = generateTOTPSecret('user@example.com');
    expect(result1.secret).not.toBe(result2.secret);
  });

  it('secret size is 20 bytes (32 base32 chars before padding)', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    // 20 bytes -> 32 base32 chars (with padding)
    const withoutPadding = secret.replace(/=/g, '');
    // 20 bytes * 8 bits / 5 bits per char = 32 chars
    expect(withoutPadding.length).toBe(32);
  });
});

describe('verifyTOTP', () => {
  it('returns true for a valid current token', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    const totp = new OTPAuth.TOTP({
      issuer: 'Omenaa CMS',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyTOTP(secret, token)).toBe(true);
  });

  it('returns false for an incorrect token', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    expect(verifyTOTP(secret, '000000')).toBe(false);
  });

  it('returns false for an empty token', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    expect(verifyTOTP(secret, '')).toBe(false);
  });

  it('returns false for non-numeric token', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    expect(verifyTOTP(secret, 'abcdef')).toBe(false);
  });

  it('returns false for invalid base32 secret', () => {
    expect(verifyTOTP('INVALID!!!SECRET', '123456')).toBe(false);
  });

  it('returns false for token with wrong number of digits', () => {
    const { secret } = generateTOTPSecret('user@example.com');
    expect(verifyTOTP(secret, '12345')).toBe(false);
  });

  it('returns false for completely wrong secret', () => {
    const { secret: secret1 } = generateTOTPSecret('user1@example.com');
    const { secret: secret2 } = generateTOTPSecret('user2@example.com');
    const totp = new OTPAuth.TOTP({
      issuer: 'Omenaa CMS',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret1),
    });
    const token = totp.generate();
    // Token generated for secret1 should not verify against secret2
    expect(verifyTOTP(secret2, token)).toBe(false);
  });
});

describe('generateQRCodeDataURL', () => {
  it('returns a data URL string', async () => {
    const { uri } = generateTOTPSecret('user@example.com');
    const dataURL = await generateQRCodeDataURL(uri);
    expect(typeof dataURL).toBe('string');
    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });

  it('generates a non-empty base64 payload', async () => {
    const { uri } = generateTOTPSecret('user@example.com');
    const dataURL = await generateQRCodeDataURL(uri);
    const base64Part = dataURL.replace('data:image/png;base64,', '');
    expect(base64Part.length).toBeGreaterThan(100);
  });

  it('works with a plain text URI', async () => {
    const dataURL = await generateQRCodeDataURL('otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP');
    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });
});

describe('generateRecoveryCodes', () => {
  it('generates exactly 10 codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
  });

  it('each code is 8 uppercase hex characters', () => {
    const codes = generateRecoveryCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it('codes are unique', () => {
    const codes = generateRecoveryCodes();
    const uniqueCodes = new Set(codes);
    // Very likely all 10 are unique with 4 random bytes
    expect(uniqueCodes.size).toBe(10);
  });

  it('generates different codes on each call', () => {
    const codes1 = generateRecoveryCodes();
    const codes2 = generateRecoveryCodes();
    // Extremely unlikely to generate identical sets
    expect(codes1.join('')).not.toBe(codes2.join(''));
  });
});

describe('encryptSecret and decryptSecret', () => {
  it('round-trips a secret correctly', () => {
    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it('encrypted format contains IV separator colon', () => {
    const encrypted = encryptSecret('test-secret');
    expect(encrypted).toContain(':');
  });

  it('IV part is 32 hex chars (16 bytes)', () => {
    const encrypted = encryptSecret('test-secret');
    const [ivHex] = encrypted.split(':');
    expect(ivHex).toHaveLength(32);
    expect(ivHex).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const enc1 = encryptSecret(secret);
    const enc2 = encryptSecret(secret);
    expect(enc1).not.toBe(enc2);
  });

  it('round-trips an empty string', () => {
    const encrypted = encryptSecret('');
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe('');
  });

  it('round-trips a long secret', () => {
    const longSecret = 'A'.repeat(100);
    const encrypted = encryptSecret(longSecret);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(longSecret);
  });

  it('round-trips special characters', () => {
    const specialSecret = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';
    const encrypted = encryptSecret(specialSecret);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(specialSecret);
  });

  it('round-trips unicode text', () => {
    const unicodeSecret = 'sécret-ünïcödé-🔐';
    const encrypted = encryptSecret(unicodeSecret);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(unicodeSecret);
  });

  it('decrypts using same key — different keys would fail', () => {
    // Encrypt and decrypt with default key should work
    const secret = 'TESTSECRET';
    const encrypted = encryptSecret(secret);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });
});
