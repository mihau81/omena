'use client';

import { useEffect, useState } from 'react';
import StatCard from '../components/StatCard';

interface ReportsData {
  salesSummary: Array<{
    auctionId: string;
    auctionTitle: string;
    auctionSlug: string;
    totalHammerPrice: number;
    avgHammerPrice: number;
    lotCount: number;
    soldCount: number;
    sellThroughRate: number;
    buyersPremiumRate: number;
  }>;
  userActivity: {
    totalUsers: number;
    activeBidders: number;
    pendingRegistrations: number;
  };
  revenueByAuction: Array<{
    auctionId: string;
    auctionTitle: string;
    auctionSlug: string;
    hammerPrice: number;
    buyersPremium: number;
    totalRevenue: number;
    lotCount: number;
  }>;
  overallStats: {
    totalRevenue: number;
    totalLots: number;
    soldLots: number;
    overallSellThroughRate: number;
    activeUsers: number;
    pendingRegistrations: number;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const response = await fetch('/api/admin/reports');
        if (!response.ok) {
          throw new Error('Failed to fetch reports');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Reports</h1>
          <p className="text-sm text-taupe mt-1">Dashboard analytics and sales data</p>
        </div>
        <div className="text-center py-12 text-taupe">Loading reports...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Reports</h1>
          <p className="text-sm text-taupe mt-1">Dashboard analytics and sales data</p>
        </div>
        <div className="text-center py-12 text-red-600">{error || 'Failed to load reports'}</div>
      </div>
    );
  }

  const { overallStats, salesSummary, userActivity, revenueByAuction } = data;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate max revenue for bar chart scaling
  const maxRevenue = Math.max(...revenueByAuction.map((a) => a.totalRevenue), 1);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Reports</h1>
        <p className="text-sm text-taupe mt-1">Dashboard analytics and sales data</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(overallStats.totalRevenue)}
          sublabel={`${overallStats.totalLots} lots`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          }
        />
        <StatCard
          label="Sell-Through Rate"
          value={`${overallStats.overallSellThroughRate.toFixed(1)}%`}
          sublabel={`${overallStats.soldLots}/${overallStats.totalLots} lots sold`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 12.75h.007v.008H9.75V12.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5H12a.75.75 0 0 0-.75.75v2.25c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75v-2.25a.75.75 0 0 0-.75-.75Zm3.75-7.5h-2.25A.75.75 0 0 0 13.5 5.25v9c0 .414.336.75.75.75h2.25a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75Z" />
            </svg>
          }
        />
        <StatCard
          label="Active Bidders"
          value={userActivity.activeBidders}
          sublabel={`of ${userActivity.totalUsers} users`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Registrations"
          value={userActivity.pendingRegistrations}
          sublabel="Awaiting approval"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      {/* Sales Summary Table */}
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        <div className="p-5 border-b border-beige">
          <h2 className="text-lg font-serif font-bold text-dark-brown">Sales by Auction</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-gray-50">
                <th className="px-5 py-3 text-left font-medium text-taupe">Auction</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Total Hammer Price</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Avg Price</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Lots</th>
                <th className="px-5 py-3 text-right font-medium text-taupe">Sell-Through</th>
              </tr>
            </thead>
            <tbody>
              {salesSummary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-taupe">
                    No auction data available
                  </td>
                </tr>
              ) : (
                salesSummary.map((auction) => (
                  <tr key={auction.auctionId} className="border-b border-beige hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-dark-brown">{auction.auctionTitle}</td>
                    <td className="px-5 py-3 text-right text-dark-brown">{formatCurrency(auction.totalHammerPrice)}</td>
                    <td className="px-5 py-3 text-right text-dark-brown">{formatCurrency(auction.avgHammerPrice)}</td>
                    <td className="px-5 py-3 text-right text-taupe">
                      {auction.soldCount}/{auction.lotCount}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-medium text-dark-brown">{auction.sellThroughRate.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue by Auction - Bar Chart */}
      <div className="bg-white rounded-xl border border-beige p-5">
        <div className="mb-6">
          <h2 className="text-lg font-serif font-bold text-dark-brown">Revenue by Auction</h2>
          <p className="text-sm text-taupe mt-1">Hammer price + buyer's premium</p>
        </div>

        <div className="space-y-4">
          {revenueByAuction.length === 0 ? (
            <div className="text-center py-8 text-taupe">No revenue data available</div>
          ) : (
            revenueByAuction.map((auction) => {
              const barWidth = (auction.totalRevenue / maxRevenue) * 100;
              return (
                <div key={auction.auctionId} className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium text-dark-brown">{auction.auctionTitle}</span>
                    <span className="text-sm text-taupe">{formatCurrency(auction.totalRevenue)}</span>
                  </div>
                  <div className="w-full bg-beige rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold/70 rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="text-xs text-taupe flex justify-between">
                    <span>Hammer: {formatCurrency(auction.hammerPrice)}</span>
                    <span>Premium: {formatCurrency(auction.buyersPremium)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
