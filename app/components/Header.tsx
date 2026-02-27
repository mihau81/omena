'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency, CURRENCIES, type CurrencyCode } from '../lib/CurrencyContext';
import { useBidding } from '../lib/BiddingContext';
import { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '../lib/i18n';

export default function Header() {
  const { locale, t } = useLocale();
  const { currency, setCurrency } = useCurrency();
  const { getUserBids } = useBidding();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langDropdown, setLangDropdown] = useState(false);
  const [currDropdown, setCurrDropdown] = useState(false);
  const pathname = usePathname();
  const langRef = useRef<HTMLDivElement>(null);
  const currRef = useRef<HTMLDivElement>(null);

  const userBidsCount = getUserBids().length;

  const navLinks = [
    { href: `/${locale}`, label: t.navHome },
    { href: `/${locale}/about`, label: t.navAbout },
    { href: `/${locale}/auctions`, label: t.navAuctions },
    { href: `/${locale}/events`, label: t.navEvents },
    { href: `/${locale}/press`, label: t.navPress },
    { href: `/${locale}/contact`, label: t.navContact },
    { href: `/${locale}/my-bids`, label: t.navMyBids },
  ];

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangDropdown(false);
      if (currRef.current && !currRef.current.contains(e.target as Node)) setCurrDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Switch locale: navigate to same page with different locale prefix
  function switchLocale(newLocale: string) {
    const currentPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
    window.location.href = `/omena/${newLocale}${currentPath === '/' ? '' : currentPath}`;
  }

  // Check if link is active
  function isActive(href: string) {
    if (href === `/${locale}`) return pathname === `/${locale}` || pathname === `/${locale}/`;
    return pathname.startsWith(href);
  }

  return (
    <>
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-cream/90 shadow-sm backdrop-blur-md' : 'bg-cream'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8 md:py-5">
          {/* Logo */}
          <Link href={`/${locale}`} className="font-serif text-xl tracking-widest text-dark-brown md:text-2xl">
            OMENA
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`relative py-1 text-sm tracking-wide transition-colors duration-200 hover:text-gold ${
                      isActive(link.href)
                        ? 'text-dark-brown after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gold'
                        : 'text-taupe'
                    }`}
                  >
                    {link.label}
                    {link.href === `/${locale}/my-bids` && userBidsCount > 0 && (
                      <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white">
                        {userBidsCount > 9 ? '9+' : userBidsCount}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Desktop: Language + Currency selectors */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language dropdown */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => { setLangDropdown(!langDropdown); setCurrDropdown(false); }}
                className="flex items-center gap-1.5 rounded-lg border border-beige px-3 py-1.5 text-sm text-dark-brown transition-colors hover:border-gold"
              >
                <span>{LOCALE_FLAGS[locale as Locale]}</span>
                <span className="hidden xl:inline">{LOCALE_LABELS[locale as Locale]}</span>
                <ChevronDown />
              </button>
              {langDropdown && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-beige bg-white py-1 shadow-lg z-50">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => { switchLocale(loc); setLangDropdown(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-beige/50 ${
                        loc === locale ? 'font-medium text-gold' : 'text-dark-brown'
                      }`}
                    >
                      <span>{LOCALE_FLAGS[loc]}</span>
                      <span>{LOCALE_LABELS[loc]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Currency dropdown */}
            <div ref={currRef} className="relative">
              <button
                onClick={() => { setCurrDropdown(!currDropdown); setLangDropdown(false); }}
                className="flex items-center gap-1.5 rounded-lg border border-beige px-3 py-1.5 text-sm text-dark-brown transition-colors hover:border-gold"
              >
                <span>{CURRENCIES.find(c => c.code === currency)?.symbol}</span>
                <span className="hidden xl:inline">{currency}</span>
                <ChevronDown />
              </button>
              {currDropdown && (
                <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-beige bg-white py-1 shadow-lg z-50">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => { setCurrency(c.code); setCurrDropdown(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-beige/50 ${
                        c.code === currency ? 'font-medium text-gold' : 'text-dark-brown'
                      }`}
                    >
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button type="button" onClick={() => setMenuOpen(true)} className="flex h-10 w-10 items-center justify-center lg:hidden" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-dark-brown">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <div className={`fixed inset-0 z-40 transition-all duration-300 lg:hidden ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div className="absolute inset-0 bg-dark-brown/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
        <div className={`absolute inset-y-0 right-0 w-full max-w-sm bg-cream transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-end px-5 py-4">
            <button type="button" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-dark-brown">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-col items-center gap-6 pt-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`font-serif text-2xl tracking-wide transition-colors duration-200 ${
                  isActive(link.href) ? 'text-gold' : 'text-dark-brown hover:text-gold'
                }`}
              >
                {link.label}
                {link.href === `/${locale}/my-bids` && userBidsCount > 0 && (
                  <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                    {userBidsCount > 9 ? '9+' : userBidsCount}
                  </span>
                )}
              </Link>
            ))}

            {/* Mobile language/currency */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex gap-2">
                {SUPPORTED_LOCALES.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => switchLocale(loc)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      loc === locale ? 'bg-gold text-white' : 'bg-beige text-dark-brown'
                    }`}
                  >
                    {LOCALE_FLAGS[loc]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    c.code === currency ? 'bg-gold text-white' : 'bg-beige text-dark-brown'
                  }`}
                >
                  {c.symbol}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
