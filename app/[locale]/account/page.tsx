'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/utils';
import { useLocale } from '@/app/lib/LocaleContext';
import { useCurrency } from '@/app/lib/CurrencyContext';

interface DashboardStats {
  activeBids: number;
  winningBids: number;
  favorites: number;
  unreadNotifications: number;
  pendingInvoices: number;
}

export default function AccountDashboard() {
  const { locale } = useLocale();
  const { formatPrice } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [bidsRes, notifsRes, favsRes, invoicesRes] = await Promise.all([
          fetch(apiUrl('/api/user/bids')),
          fetch(apiUrl('/api/me/notifications?limit=100')),
          fetch(apiUrl('/api/me/favorites')),
          fetch(apiUrl('/api/me/invoices')),
        ]);

        const bidsData = bidsRes.ok ? await bidsRes.json() : { bids: [] };
        const notifsData = notifsRes.ok ? await notifsRes.json() : { notifications: [], unreadCount: 0 };
        const favsData = favsRes.ok ? await favsRes.json() : { favorites: [] };
        const invoicesData = invoicesRes.ok ? await invoicesRes.json() : { invoices: [] };

        const allBids = bidsData.bids ?? [];

        setStats({
          activeBids: allBids.length,
          winningBids: allBids.filter((b: { isWinning: boolean }) => b.isWinning).length,
          favorites: (favsData.favorites ?? []).length,
          unreadNotifications: notifsData.unreadCount ?? 0,
          pendingInvoices: (invoicesData.invoices ?? []).filter(
            (i: { status: string }) => i.status === 'pending' || i.status === 'sent',
          ).length,
        });
      } catch {
        // leave null
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = stats
    ? [
        { label: 'Active Bids', value: stats.activeBids, href: `/${locale}/account/bids`, color: 'text-dark-brown' },
        { label: 'Winning', value: stats.winningBids, href: `/${locale}/account/bids`, color: 'text-green-600' },
        { label: 'Favorites', value: stats.favorites, href: `/${locale}/account/favorites`, color: 'text-gold' },
        { label: 'Unread', value: stats.unreadNotifications, href: `/${locale}/account/notifications`, color: stats.unreadNotifications > 0 ? 'text-red-500' : 'text-dark-brown' },
        { label: 'Invoices Due', value: stats.pendingInvoices, href: `/${locale}/account/invoices`, color: stats.pendingInvoices > 0 ? 'text-orange-500' : 'text-dark-brown' },
      ]
    : [];

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">Dashboard</h1>
      <p className="mt-2 text-sm text-taupe">Overview of your account activity.</p>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : stats ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-xl border border-beige bg-white p-5 transition-shadow hover:shadow-md"
            >
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              <p className="mt-1 text-sm text-taupe">{card.label}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-taupe">Failed to load dashboard data.</p>
      )}
    </div>
  );
}
