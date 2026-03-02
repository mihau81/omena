import { describe, it, expect } from 'vitest';
import { pl } from '@/app/lib/i18n/pl';
import { en } from '@/app/lib/i18n/en';
import { de } from '@/app/lib/i18n/de';
import { fr } from '@/app/lib/i18n/fr';
import { es } from '@/app/lib/i18n/es';
import {
  getTranslation,
  isValidLocale,
  getSupportedLocales,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from '@/app/lib/i18n/index';

const allLocales = { pl, en, de, fr, es } as const;

describe('translation completeness', () => {
  const baseKeys = Object.keys(pl);

  it('pl has all keys (reference locale)', () => {
    expect(baseKeys.length).toBeGreaterThan(0);
  });

  for (const [locale, dict] of Object.entries(allLocales)) {
    it(`${locale} has all keys that pl has`, () => {
      for (const key of baseKeys) {
        expect(
          dict,
          `Locale "${locale}" is missing key "${key}"`
        ).toHaveProperty(key);
      }
    });

    it(`${locale} has no extra keys not in pl`, () => {
      for (const key of Object.keys(dict)) {
        expect(
          baseKeys,
          `Locale "${locale}" has extra key "${key}" not in pl`
        ).toContain(key);
      }
    });

    it(`${locale} has no empty translations`, () => {
      for (const [key, value] of Object.entries(dict)) {
        expect(
          value,
          `Locale "${locale}" has empty value for key "${key}"`
        ).toBeTruthy();
      }
    });
  }
});

describe('getTranslation', () => {
  it('returns pl dictionary for "pl"', () => {
    const dict = getTranslation('pl');
    expect(dict.navHome).toBe(pl.navHome);
  });

  it('returns en dictionary for "en"', () => {
    const dict = getTranslation('en');
    expect(dict.navHome).toBe(en.navHome);
  });

  it('falls back to default locale (pl) for unknown locale', () => {
    const dict = getTranslation('xx');
    expect(dict).toEqual(pl);
  });

  it('falls back to default locale for empty string', () => {
    const dict = getTranslation('');
    expect(dict).toEqual(pl);
  });

  it('returns de dictionary for "de"', () => {
    const dict = getTranslation('de');
    expect(dict).toEqual(de);
  });

  it('returns fr dictionary for "fr"', () => {
    const dict = getTranslation('fr');
    expect(dict).toEqual(fr);
  });

  it('returns es dictionary for "es"', () => {
    const dict = getTranslation('es');
    expect(dict).toEqual(es);
  });
});

describe('isValidLocale', () => {
  it('returns true for supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isValidLocale(locale)).toBe(true);
    }
  });

  it('returns false for unknown locale', () => {
    expect(isValidLocale('xx')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidLocale('')).toBe(false);
  });

  it('returns false for uppercase locale', () => {
    expect(isValidLocale('PL')).toBe(false);
  });
});

describe('getSupportedLocales', () => {
  it('returns array with all 5 locales', () => {
    const locales = getSupportedLocales();
    expect(locales).toHaveLength(5);
  });

  it('includes pl, en, de, fr, es', () => {
    const locales = getSupportedLocales();
    expect(locales).toContain('pl');
    expect(locales).toContain('en');
    expect(locales).toContain('de');
    expect(locales).toContain('fr');
    expect(locales).toContain('es');
  });
});

describe('DEFAULT_LOCALE', () => {
  it('is "pl"', () => {
    expect(DEFAULT_LOCALE).toBe('pl');
  });
});
