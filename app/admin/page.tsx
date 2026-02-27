import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StatCard from './components/StatCard';
import StatusBadge from './components/StatusBadge';

// Mock data — will be replaced with real DB queries in Task #10
const MOCK_STATS = {
  auctions: { total: 12, live: 2, preview: 1, draft: 3, archive: 6 },
  lots: 347,
  users: 89,
  bids: 1243,
};

const MOCK_LIVE_AUCTIONS = [
  { id: '1', title: 'Spring Contemporary Art', status: 'live', lots: 45, bids: 312, registrations: 23 },
  { id: '2', title: 'Old Masters & 19th Century', status: 'live', lots: 38, bids: 189, registrations: 15 },
];

const MOCK_ACTIVITY = [
  { id: 1, action: 'New bid', detail: 'Lot #12 — PLN 45,000', time: '2 minutes ago', type: 'bid' },
  { id: 2, action: 'User registered', detail: 'jan.kowalski@example.com', time: '15 minutes ago', type: 'user' },
  { id: 3, action: 'Bid registration', detail: 'Spring Contemporary Art — paddle #24', time: '1 hour ago', type: 'registration' },
  { id: 4, action: 'New bid', detail: 'Lot #7 — PLN 22,000', time: '1 hour ago', type: 'bid' },
  { id: 5, action: 'Lot updated', detail: 'Lot #34 estimate changed', time: '2 hours ago', type: 'lot' },
  { id: 6, action: 'New bid', detail: 'Lot #19 — PLN 8,500', time: '3 hours ago', type: 'bid' },
  { id: 7, action: 'Auction status', detail: 'Old Masters moved to live', time: '5 hours ago', type: 'auction' },
  { id: 8, action: 'User registered', detail: 'maria.nowak@example.com', time: '6 hours ago', type: 'user' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  bid: 'text-green-600 bg-green-100',
  user: 'text-blue-600 bg-blue-100',
  registration: 'text-gold bg-gold/10',
  lot: 'text-indigo-600 bg-indigo-100',
  auction: 'text-red-600 bg-red-100',
};

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || session.user.userType !== 'admin') {
    redirect('/admin/login');
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Dashboard</h1>
        <p className="text-sm text-taupe mt-1">
          Welcome back, {session.user.name.split(' ')[0]}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Auctions"
          value={MOCK_STATS.auctions.total}
          sublabel={`${MOCK_STATS.auctions.live} live, ${MOCK_STATS.auctions.preview} preview`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Lots"
          value={MOCK_STATS.lots}
          sublabel="Across all auctions"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          }
        />
        <StatCard
          label="Users"
          value={MOCK_STATS.users}
          sublabel="Registered clients"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Total Bids"
          value={MOCK_STATS.bids.toLocaleString()}
          sublabel="All-time bids placed"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Auctions */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-beige">
          <div className="px-5 py-4 border-b border-beige flex items-center justify-between">
            <h2 className="font-semibold text-dark-brown">Live Auctions</h2>
            <span className="text-xs text-taupe">{MOCK_LIVE_AUCTIONS.length} active</span>
          </div>
          <div className="divide-y divide-beige/50">
            {MOCK_LIVE_AUCTIONS.map((auction) => (
              <div key={auction.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-dark-brown truncate">{auction.title}</p>
                    <StatusBadge status={auction.status} />
                  </div>
                  <p className="text-xs text-taupe mt-1">
                    {auction.lots} lots &middot; {auction.bids} bids &middot; {auction.registrations} registrations
                  </p>
                </div>
                <button className="shrink-0 text-xs font-medium text-gold hover:text-gold-dark transition-colors">
                  Manage
                </button>
              </div>
            ))}
            {MOCK_LIVE_AUCTIONS.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-taupe">
                No live auctions at the moment.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-beige">
          <div className="px-5 py-4 border-b border-beige">
            <h2 className="font-semibold text-dark-brown">Recent Activity</h2>
          </div>
          <div className="divide-y divide-beige/30 max-h-96 overflow-y-auto">
            {MOCK_ACTIVITY.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ACTIVITY_ICONS[item.type] ?? 'text-gray-600 bg-gray-100'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-dark-brown font-medium">{item.action}</p>
                  <p className="text-xs text-taupe truncate">{item.detail}</p>
                  <p className="text-xs text-taupe/60 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Auction
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-dark-brown text-sm font-medium rounded-lg border border-beige hover:bg-beige/30 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          View Live Auctions
        </button>
      </div>
    </div>
  );
}
