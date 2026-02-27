import { pl } from './pl';
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';

export type DictionaryKey = keyof typeof pl;
export type Dictionary = Record<DictionaryKey, string>;

export const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pl';

const dictionaries: Record<Locale, Dictionary> = { pl, en, de, fr, es };

export function getTranslation(locale: string): Dictionary {
  if (locale in dictionaries) return dictionaries[locale as Locale];
  return dictionaries[DEFAULT_LOCALE];
}

export function getSupportedLocales(): readonly string[] {
  return SUPPORTED_LOCALES;
}

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  pl: '\u{1F1F5}\u{1F1F1}',
  en: '\u{1F1EC}\u{1F1E7}',
  de: '\u{1F1E9}\u{1F1EA}',
  fr: '\u{1F1EB}\u{1F1F7}',
  es: '\u{1F1EA}\u{1F1F8}',
};
