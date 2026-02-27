'use client';

import { useEffect, useState, useCallback } from 'react';
import AnalyticsCard from '../components/AnalyticsCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalRevenue: number;
  totalLots: number;
  soldLots: number;
  overallSellThroughRate: number;
  activeUsers: number;
  pendingRegistrations: number;
  avgHammerToEstimateRatio: number | null;
  newUsersLast30Days: number;
  activeBiddersLast30Days: number;
}

interface RevenueTrend {
  month: string;
  monthLabel: string;
  totalHammer: number;
  totalPremium: number;
  totalRevenue: number;
  lotsSold: number;
}

interface ArtistRow {
  artist: string;
  totalHammerValue: number;
  lotsSold: number;
  totalLots: number;
  avgHammerPrice: number;
}

interface BidActivityData {
  byHour: Array<{ hour: number; bidCount: number }>;
  byDayOfWeek: Array<{ dayOfWeek: number; dayName: string; bidCount: number }>;
}

interface UserStats {
  totalUsers: number;
  newUsersLast30Days: number;
  newUsersLast7Days: number;
  activeBiddersLast30Days: number;
  returningBiddersLast30Days: number;
  pendingRegistrations: number;
}

interface AuctionRow {
  auctionId: string;
  auctionTitle: string;
  auctionSlug: string;
  startDate: string;
  status: string;
  totalLots: number;
  soldLots: number;
  sellThroughRate: number;
  totalHammerPrice: number;
  buyersPremium: number;
  totalRevenue: number;
  avgHammerPrice: number;
}

interface LotPerformanceRow {
  status: string;
  count: number;
  avgHammerPrice: number | null;
  totalHammerPrice: number;
  avgEstimateMin: number;
}

type TabId = 'overview' | 'revenue' | 'artists' | 'activity' | 'comparison' | 'users';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatNumber = (n: number) =>
  new Intl.NumberFormat('pl-PL').format(n);

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    catalogued: 'Catalogued',
    published: 'Published',
    active: 'Active',
    sold: 'Sold',
    passed: 'Passed',
    withdrawn: 'Withdrawn',
  };
  return map[status] ?? status;
}

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    preview: 'bg-blue-50 text-blue-700',
    live: 'bg-green-50 text-green-700',
    reconciliation: 'bg-amber-50 text-amber-700',
    archive: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// Simple bar using a div, max width proportional to highest value
function MiniBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-beige rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${className || 'bg-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-taupe tabular-nums w-8 text-right">{formatNumber(value)}</span>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({ id, label, active, onClick }: { id: TabId; label: string; active: boolean; onClick: (id: TabId) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
        active
          ? 'bg-dark-brown text-white'
          : 'text-taupe hover:text-dark-brown hover:bg-beige'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-beige overflow-hidden">
      <div className="p-5 border-b border-beige">
        <h2 className="text-lg font-serif font-bold text-dark-brown">{title}</h2>
        {subtitle && <p className="text-sm text-taupe mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function TableSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-beige overflow-hidden">
      <div className="p-5 border-b border-beige">
        <h2 className="text-lg font-serif font-bold text-dark-brown">{title}</h2>
        {subtitle && <p className="text-sm text-taupe mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'artists', label: 'Top Artists' },
  { id: 'activity', label: 'Bid Activity' },
  { id: 'comparison', label: 'Auction Comparison' },
  { id: 'users', label: 'User Metrics' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenue, setRevenue] = useState<RevenueTrend[] | null>(null);
  const [artists, setArtists] = useState<ArtistRow[] | null>(null);
  const [activity, setActivity] = useState<BidActivityData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [comparison, setComparison] = useState<AuctionRow[] | null>(null);
  const [lotPerformance, setLotPerformance] = useState<LotPerformanceRow[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: TabId) => {
    setLoading(true);
    setError(null);

    try {
      const base = '/omena/api/admin/analytics';

      if (tab === 'overview') {
        const [ovRes, perfRes] = await Promise.all([
          fetch(`${base}?type=overview`),
          fetch(`${base}?type=lot-performance`),
        ]);
        if (!ovRes.ok || !perfRes.ok) throw new Error('Failed to fetch overview data');
        const ovData = await ovRes.json() as OverviewData;
        const perfData = await perfRes.json() as { performance: LotPerformanceRow[] };
        setOverview(ovData);
        setLotPerformance(perfData.performance);
      } else if (tab === 'revenue') {
        const res = await fetch(`${base}?type=revenue&months=12`);
        if (!res.ok) throw new Error('Failed to fetch revenue data');
        const data = await res.json() as { trends: RevenueTrend[] };
        setRevenue(data.trends);
      } else if (tab === 'artists') {
        const res = await fetch(`${base}?type=artists&limit=20`);
        if (!res.ok) throw new Error('Failed to fetch artist data');
        const data = await res.json() as { artists: ArtistRow[] };
        setArtists(data.artists);
      } else if (tab === 'activity') {
        const res = await fetch(`${base}?type=activity&days=30`);
        if (!res.ok) throw new Error('Failed to fetch activity data');
        const data = await res.json() as BidActivityData;
        setActivity(data);
      } else if (tab === 'users') {
        const res = await fetch(`${base}?type=users`);
        if (!res.ok) throw new Error('Failed to fetch user data');
        const data = await res.json() as UserStats;
        setUserStats(data);
      } else if (tab === 'comparison') {
        const res = await fetch(`${base}?type=comparison`);
        if (!res.ok) throw new Error('Failed to fetch comparison data');
        const data = await res.json() as { auctions: AuctionRow[] };
        setComparison(data.auctions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(activeTab);
  }, [activeTab, fetchData]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  // ─── Overview Tab ───────────────────────────────────────────────────────────

  function OverviewTab() {
    if (!overview) return null;

    const soldStatusRow = lotPerformance?.find((r) => r.status === 'sold');
    const passedStatusRow = lotPerformance?.find((r) => r.status === 'passed');
    const withdrawnStatusRow = lotPerformance?.find((r) => r.status === 'withdrawn');

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total Revenue"
            value={formatCurrency(overview.totalRevenue)}
            subtitle="Hammer price + buyer's premium"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
              </svg>
            }
          />
          <AnalyticsCard
            title="Sell-Through Rate"
            value={`${overview.overallSellThroughRate.toFixed(1)}%`}
            subtitle={`${formatNumber(overview.soldLots)} of ${formatNumber(overview.totalLots)} lots sold`}
            trend={
              overview.overallSellThroughRate >= 70
                ? { direction: 'up', label: 'Strong performance' }
                : overview.overallSellThroughRate >= 50
                  ? { direction: 'flat', label: 'Average performance' }
                  : { direction: 'down', label: 'Below average' }
            }
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
          />
          <AnalyticsCard
            title="Avg Hammer / Estimate"
            value={overview.avgHammerToEstimateRatio !== null ? `${overview.avgHammerToEstimateRatio.toFixed(2)}x` : 'N/A'}
            subtitle="Hammer price vs low estimate"
            trend={
              overview.avgHammerToEstimateRatio === null
                ? undefined
                : overview.avgHammerToEstimateRatio >= 1.2
                  ? { direction: 'up', label: 'Exceeding estimates' }
                  : overview.avgHammerToEstimateRatio >= 0.9
                    ? { direction: 'flat', label: 'Near estimates' }
                    : { direction: 'down', label: 'Below estimates' }
            }
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
              </svg>
            }
          />
          <AnalyticsCard
            title="Active Bidders (30d)"
            value={formatNumber(overview.activeBiddersLast30Days)}
            subtitle={`${formatNumber(overview.newUsersLast30Days)} new registrations`}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
          />
        </div>

        {/* Lot Outcome Summary */}
        {lotPerformance && lotPerformance.length > 0 && (
          <Section title="Lot Outcomes" subtitle="Distribution of lot results across all auctions">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm font-medium text-green-700">Sold</p>
                <p className="text-2xl font-bold text-green-800 mt-1">{formatNumber(soldStatusRow?.count ?? 0)}</p>
                <p className="text-xs text-green-600 mt-1">
                  {soldStatusRow?.avgHammerPrice ? `Avg ${formatCurrency(soldStatusRow.avgHammerPrice)}` : 'No sales data'}
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-sm font-medium text-amber-700">Passed</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">{formatNumber(passedStatusRow?.count ?? 0)}</p>
                <p className="text-xs text-amber-600 mt-1">Did not meet reserve</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-gray-600">Withdrawn</p>
                <p className="text-2xl font-bold text-gray-700 mt-1">{formatNumber(withdrawnStatusRow?.count ?? 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Removed before/during sale</p>
              </div>
            </div>
          </Section>
        )}
      </div>
    );
  }

  // ─── Revenue Tab ────────────────────────────────────────────────────────────

  function RevenueTab() {
    if (!revenue) return null;

    if (revenue.length === 0) {
      return (
        <Section title="Monthly Revenue" subtitle="Last 12 months">
          <p className="text-taupe text-center py-8">No revenue data available</p>
        </Section>
      );
    }

    const maxRevenue = Math.max(...revenue.map((r) => r.totalRevenue), 1);
    const totalRevenue = revenue.reduce((s, r) => s + r.totalRevenue, 0);
    const totalSold = revenue.reduce((s, r) => s + r.lotsSold, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnalyticsCard
            title="Total Revenue (12 months)"
            value={formatCurrency(totalRevenue)}
            subtitle="Hammer price + buyer's premium"
          />
          <AnalyticsCard
            title="Lots Sold (12 months)"
            value={formatNumber(totalSold)}
            subtitle="Across all auctions"
          />
          <AnalyticsCard
            title="Avg Monthly Revenue"
            value={formatCurrency(Math.round(totalRevenue / revenue.length))}
            subtitle={`Over ${revenue.length} month${revenue.length !== 1 ? 's' : ''}`}
          />
        </div>

        <TableSection title="Monthly Revenue Breakdown" subtitle="Last 12 months — hammer price + buyer's premium">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-gray-50">
                <th className="px-5 py-3 text-left font-medium text-taupe">Month</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Lots Sold</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Hammer Price</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Buyer's Premium</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Total Revenue</th>
                <th className="px-5 py-3 text-left font-medium text-taupe w-32">Bar</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((row) => (
                <tr key={row.month} className="border-b border-beige hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-dark-brown">{row.monthLabel}</td>
                  <td className="px-5 py-3 text-right text-taupe">{formatNumber(row.lotsSold)}</td>
                  <td className="px-5 py-3 text-right text-dark-brown">{formatCurrency(row.totalHammer)}</td>
                  <td className="px-5 py-3 text-right text-taupe">{formatCurrency(row.totalPremium)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-dark-brown">{formatCurrency(row.totalRevenue)}</td>
                  <td className="px-5 py-3 w-32">
                    <MiniBar value={row.totalRevenue} max={maxRevenue} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-beige bg-gray-50">
                <td className="px-5 py-3 font-semibold text-dark-brown">Total</td>
                <td className="px-5 py-3 text-right font-semibold text-dark-brown">{formatNumber(totalSold)}</td>
                <td className="px-5 py-3 text-right font-semibold text-dark-brown">
                  {formatCurrency(revenue.reduce((s, r) => s + r.totalHammer, 0))}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-taupe">
                  {formatCurrency(revenue.reduce((s, r) => s + r.totalPremium, 0))}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-dark-brown">{formatCurrency(totalRevenue)}</td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </TableSection>
      </div>
    );
  }

  // ─── Artists Tab ────────────────────────────────────────────────────────────

  function ArtistsTab() {
    if (!artists) return null;

    if (artists.length === 0) {
      return (
        <Section title="Top Artists by Sale Value" subtitle="Artists with most total hammer value">
          <p className="text-taupe text-center py-8">No artist data available</p>
        </Section>
      );
    }

    const maxValue = Math.max(...artists.map((a) => a.totalHammerValue), 1);

    return (
      <TableSection title="Top Artists by Total Sale Value" subtitle="Ranked by total hammer price across all auctions">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-gray-50">
              <th className="px-5 py-3 text-left font-medium text-taupe">#</th>
              <th className="px-5 py-3 text-left font-medium text-taupe">Artist</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Lots Sold</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Avg Hammer</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Total Value</th>
              <th className="px-5 py-3 text-left font-medium text-taupe w-36">Share</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((row, idx) => (
              <tr key={row.artist} className="border-b border-beige hover:bg-gray-50">
                <td className="px-5 py-3 text-taupe">{idx + 1}</td>
                <td className="px-5 py-3 font-medium text-dark-brown">{row.artist}</td>
                <td className="px-5 py-3 text-right text-taupe">{formatNumber(row.lotsSold)}</td>
                <td className="px-5 py-3 text-right text-dark-brown">{formatCurrency(row.avgHammerPrice)}</td>
                <td className="px-5 py-3 text-right font-semibold text-dark-brown">{formatCurrency(row.totalHammerValue)}</td>
                <td className="px-5 py-3 w-36">
                  <MiniBar value={row.totalHammerValue} max={maxValue} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>
    );
  }

  // ─── Activity Tab ───────────────────────────────────────────────────────────

  function ActivityTab() {
    if (!activity) return null;

    const maxHour = Math.max(...activity.byHour.map((h) => h.bidCount), 1);
    const maxDay = Math.max(...activity.byDayOfWeek.map((d) => d.bidCount), 1);
    const totalBids = activity.byHour.reduce((s, h) => s + h.bidCount, 0);

    // Pad hours 0-23
    const hourData = Array.from({ length: 24 }, (_, i) => {
      const found = activity.byHour.find((h) => h.hour === i);
      return { hour: i, bidCount: found?.bidCount ?? 0 };
    });

    return (
      <div className="space-y-6">
        <AnalyticsCard
          title="Total Bids (last 30 days)"
          value={formatNumber(totalBids)}
          subtitle="Online, phone, floor, absentee, and system bids"
        />

        <Section title="Bids by Hour of Day" subtitle="Warsaw time (last 30 days) — when bidders are most active">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
            {hourData.map((h) => {
              const heightPct = maxHour > 0 ? Math.round((h.bidCount / maxHour) * 100) : 0;
              const isActive = h.bidCount > 0;
              return (
                <div key={h.hour} className="flex flex-col items-center gap-1">
                  <div className="relative w-full h-16 flex items-end">
                    <div
                      className={`w-full rounded-t transition-all ${isActive ? 'bg-gold' : 'bg-beige'}`}
                      style={{ height: `${Math.max(heightPct, isActive ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-taupe tabular-nums">{h.hour.toString().padStart(2, '0')}</span>
                  <span className="text-xs font-medium text-dark-brown tabular-nums">{h.bidCount}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-taupe mt-3">Hour of day (00:00–23:00, Warsaw time)</p>
        </Section>

        <Section title="Bids by Day of Week" subtitle="Last 30 days — which days see the most bidding activity">
          <div className="space-y-3">
            {activity.byDayOfWeek.map((d) => (
              <div key={d.dayOfWeek} className="flex items-center gap-3">
                <span className="text-sm font-medium text-dark-brown w-24 shrink-0">{d.dayName}</span>
                <div className="flex-1">
                  <MiniBar value={d.bidCount} max={maxDay} className="bg-gold" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  // ─── Comparison Tab ─────────────────────────────────────────────────────────

  function ComparisonTab() {
    if (!comparison) return null;

    if (comparison.length === 0) {
      return (
        <Section title="Auction Comparison" subtitle="Side-by-side performance metrics">
          <p className="text-taupe text-center py-8">No auction data available</p>
        </Section>
      );
    }

    return (
      <TableSection title="Auction Comparison" subtitle="Revenue, lots, and sell-through rate per auction">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-gray-50">
              <th className="px-5 py-3 text-left font-medium text-taupe">Auction</th>
              <th className="px-5 py-3 text-left font-medium text-taupe">Status</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Lots</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Sold</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Sell-Through</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Avg Hammer</th>
              <th className="px-5 py-3 text-right font-medium text-taupe">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.auctionId} className="border-b border-beige hover:bg-gray-50">
                <td className="px-5 py-3">
                  <span className="font-medium text-dark-brown">{row.auctionTitle}</span>
                  <span className="block text-xs text-taupe">{row.startDate ? new Date(row.startDate).toLocaleDateString('pl-PL') : ''}</span>
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-5 py-3 text-right text-taupe">{formatNumber(row.totalLots)}</td>
                <td className="px-5 py-3 text-right text-taupe">{formatNumber(row.soldLots)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`font-semibold ${row.sellThroughRate >= 70 ? 'text-green-700' : row.sellThroughRate >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                    {row.sellThroughRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-dark-brown">
                  {row.avgHammerPrice > 0 ? formatCurrency(row.avgHammerPrice) : '—'}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-dark-brown">
                  {row.totalRevenue > 0 ? formatCurrency(row.totalRevenue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>
    );
  }

  // ─── Users Tab ──────────────────────────────────────────────────────────────

  function UsersTab() {
    if (!userStats) return null;

    const returningPct =
      userStats.activeBiddersLast30Days > 0
        ? Math.round((userStats.returningBiddersLast30Days / userStats.activeBiddersLast30Days) * 100)
        : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnalyticsCard
            title="Total Registered Users"
            value={formatNumber(userStats.totalUsers)}
            subtitle="All time, non-deleted accounts"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
          />
          <AnalyticsCard
            title="New Users (30 days)"
            value={formatNumber(userStats.newUsersLast30Days)}
            subtitle={`${formatNumber(userStats.newUsersLast7Days)} in last 7 days`}
            trend={
              userStats.newUsersLast7Days > 0
                ? { direction: 'up', label: 'Active registrations' }
                : { direction: 'flat', label: 'No new registrations this week' }
            }
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
            }
          />
          <AnalyticsCard
            title="Active Bidders (30 days)"
            value={formatNumber(userStats.activeBiddersLast30Days)}
            subtitle="Placed at least one bid"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            }
          />
          <AnalyticsCard
            title="Returning Bidders (30 days)"
            value={formatNumber(userStats.returningBiddersLast30Days)}
            subtitle={`${returningPct}% of active bidders`}
            trend={
              returningPct >= 50
                ? { direction: 'up', label: 'High retention' }
                : returningPct >= 25
                  ? { direction: 'flat', label: 'Average retention' }
                  : { direction: 'down', label: 'Low retention' }
            }
          />
          <AnalyticsCard
            title="Pending Registrations"
            value={formatNumber(userStats.pendingRegistrations)}
            subtitle="Awaiting admin approval"
            trend={
              userStats.pendingRegistrations > 10
                ? { direction: 'up', label: 'Review required' }
                : userStats.pendingRegistrations > 0
                  ? { direction: 'flat', label: 'Some pending' }
                  : { direction: 'up', label: 'All clear' }
            }
          />
        </div>

        <Section title="Registration Summary" subtitle="User registration and engagement at a glance">
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-beige">
              <span className="text-sm text-taupe">Total registered users</span>
              <span className="font-semibold text-dark-brown">{formatNumber(userStats.totalUsers)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-beige">
              <span className="text-sm text-taupe">New this month (30d)</span>
              <span className="font-semibold text-dark-brown">{formatNumber(userStats.newUsersLast30Days)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-beige">
              <span className="text-sm text-taupe">New this week (7d)</span>
              <span className="font-semibold text-dark-brown">{formatNumber(userStats.newUsersLast7Days)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-beige">
              <span className="text-sm text-taupe">Active bidders (30d)</span>
              <span className="font-semibold text-dark-brown">{formatNumber(userStats.activeBiddersLast30Days)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-beige">
              <span className="text-sm text-taupe">Returning bidders (30d)</span>
              <span className="font-semibold text-dark-brown">{formatNumber(userStats.returningBiddersLast30Days)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-taupe">Pending bid registrations</span>
              <span className={`font-semibold ${userStats.pendingRegistrations > 0 ? 'text-amber-700' : 'text-dark-brown'}`}>
                {formatNumber(userStats.pendingRegistrations)}
              </span>
            </div>
          </div>
        </Section>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20 text-taupe">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading analytics...
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 text-sm">
          {error}
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':   return <OverviewTab />;
      case 'revenue':    return <RevenueTab />;
      case 'artists':    return <ArtistsTab />;
      case 'activity':   return <ActivityTab />;
      case 'comparison': return <ComparisonTab />;
      case 'users':      return <UsersTab />;
      default:           return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Analytics</h1>
        <p className="text-sm text-taupe mt-1">Detailed auction performance and bidder insights</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-beige rounded-xl w-fit">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={handleTabChange}
          />
        ))}
      </div>

      {/* Tab content */}
      {renderContent()}
    </div>
  );
}
