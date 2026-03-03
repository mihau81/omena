'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency, CURRENCIES, type CurrencyCode } from '../lib/CurrencyContext';
import { useBidding } from '../lib/BiddingContext';
import { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '../lib/i18n';
import { apiUrl } from '../lib/utils';

export default function Header() {
  const { locale, t } = useLocale();
  const { currency, setCurrency } = useCurrency();
  const { getUserBids } = useBidding();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langDropdown, setLangDropdown] = useState(false);
  const [currDropdown, setCurrDropdown] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const langRef = useRef<HTMLDivElement>(null);
  const currRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = session?.user?.userType === 'user';
  const userName = session?.user?.name || '';
  const userBidsCount = getUserBids().length;

  // Build nav links — only show "My Bids" for logged-in users
  const navLinks = [
    { href: `/${locale}`, label: t.navHome },
    { href: `/${locale}/about`, label: t.navAbout },
    { href: `/${locale}/auctions`, label: t.navAuctions },
    { href: `/${locale}/artists`, label: t.navArtists },
    { href: `/${locale}/results`, label: t.navResults },
    { href: `/${locale}/events`, label: t.navEvents },
    { href: `/${locale}/press`, label: t.navPress },
    { href: `/${locale}/contact`, label: t.navContact },
  ];

  // Fetch unread notifications count
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(apiUrl('/api/me/notifications?limit=1'))
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.unreadCount != null) setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, [isLoggedIn]);

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
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Switch locale: navigate to same page with different locale prefix
  function switchLocale(newLocale: string) {
    const currentPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
    window.location.href = apiUrl(`/${newLocale}${currentPath === '/' ? '' : currentPath}`);
  }

  // Check if link is active
  function isActive(href: string) {
    if (href === `/${locale}`) return pathname === `/${locale}` || pathname === `/${locale}/`;
    return pathname.startsWith(href);
  }

  // Get user initials
  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-cream/90 shadow-sm backdrop-blur-md' : 'bg-cream'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8 md:py-5">
          {/* Logo */}
          <Link href={`/${locale}`} className="font-serif text-xl tracking-widest text-dark-brown md:text-2xl">
            OMENAA
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`relative py-1 text-base tracking-wide transition-colors duration-200 hover:text-gold ${
                      isActive(link.href)
                        ? 'text-dark-brown after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gold'
                        : 'text-taupe'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Desktop: right side */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language dropdown */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => { setLangDropdown(!langDropdown); setCurrDropdown(false); setUserDropdown(false); }}
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
                onClick={() => { setCurrDropdown(!currDropdown); setLangDropdown(false); setUserDropdown(false); }}
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

            {/* Auth section */}
            {isLoggedIn ? (
              <>
                {/* Notification bell */}
                <Link
                  href={`/${locale}/account/notifications`}
                  className="relative flex items-center justify-center w-9 h-9 rounded-lg text-taupe hover:text-gold transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* User dropdown */}
                <div ref={userRef} className="relative">
                  <button
                    onClick={() => { setUserDropdown(!userDropdown); setLangDropdown(false); setCurrDropdown(false); }}
                    className="flex items-center gap-2 rounded-lg border border-beige px-2 py-1.5 text-sm text-dark-brown transition-colors hover:border-gold"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gold text-white text-xs font-bold">
                      {getInitials(userName)}
                    </span>
                    <ChevronDown />
                  </button>
                  {userDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-beige bg-white py-1 shadow-lg z-50">
                      <div className="px-3 py-2 border-b border-beige">
                        <p className="text-sm font-medium text-dark-brown truncate">{userName}</p>
                      </div>
                      <Link href={`/${locale}/account`} onClick={() => setUserDropdown(false)}
                        className="block px-3 py-2 text-sm text-dark-brown hover:bg-beige/50 transition-colors">
                        {t.userMenuMyAccount}
                      </Link>
                      <Link href={`/${locale}/account/bids`} onClick={() => setUserDropdown(false)}
                        className="block px-3 py-2 text-sm text-dark-brown hover:bg-beige/50 transition-colors">
                        {t.userMenuMyBids}
                      </Link>
                      <Link href={`/${locale}/account/favorites`} onClick={() => setUserDropdown(false)}
                        className="block px-3 py-2 text-sm text-dark-brown hover:bg-beige/50 transition-colors">
                        {t.userMenuFavorites}
                      </Link>
                      <div className="border-t border-beige mt-1 pt-1">
                        <button
                          onClick={() => signOut({ callbackUrl: `/omenaa/${locale}` })}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          {t.userMenuSignOut}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="px-4 py-1.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold/90 transition-colors"
              >
                {t.userMenuSignIn}
              </Link>
            )}
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
      <div className={`fixed inset-0 z-[60] transition-all duration-300 lg:hidden ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
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
              </Link>
            ))}

            {/* Auth links in mobile menu */}
            {isLoggedIn ? (
              <>
                <Link
                  href={`/${locale}/account`}
                  onClick={() => setMenuOpen(false)}
                  className="font-serif text-2xl tracking-wide text-dark-brown hover:text-gold transition-colors"
                >
                  {t.userMenuMyAccount}
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); signOut({ callbackUrl: `/omenaa/${locale}` }); }}
                  className="font-serif text-2xl tracking-wide text-red-600 hover:text-red-700 transition-colors"
                >
                  {t.userMenuSignOut}
                </button>
              </>
            ) : (
              <Link
                href={`/${locale}/login`}
                onClick={() => setMenuOpen(false)}
                className="font-serif text-2xl tracking-wide text-gold hover:text-gold/80 transition-colors"
              >
                {t.userMenuSignIn}
              </Link>
            )}

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
