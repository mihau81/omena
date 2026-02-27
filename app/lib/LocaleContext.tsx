'use client';

import React, { createContext, useContext } from 'react';
import type { Dictionary } from './i18n';

interface LocaleState {
  locale: string;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({
  locale,
  t,
  children,
}: {
  locale: string;
  t: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
