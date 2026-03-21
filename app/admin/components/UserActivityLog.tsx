'use client';

import { apiUrl } from '@/app/lib/utils';
import { useState, useEffect } from 'react';
import Pagination from './Pagination';

// Country code → flag emoji
function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  const offset = 0x1F1E6;
  const a = code.codePointAt(0)! - 65 + offset;
  const b = code.codePointAt(1)! - 65 + offset;
  return String.fromCodePoint(a) + String.fromCodePoint(b);
}

interface LoginEntry {
  id: number;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  countryCode: string | null;
  city: string | null;
  success: boolean;
  failReason: string | null;
  loginMethod: string;
  createdAt: string;
}

interface PageViewEntry {
  id: number;
  path: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function parseUA(ua: string | null): string {
  if (!ua) return '—';
  // Extract browser and OS from user agent string
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s]([\d.]+)/);
  const os = ua.match(/(Windows|Mac OS X|Linux|Android|iOS|iPhone)[\/\s]?([\d._]*)/);
  const parts: string[] = [];
  if (browser) parts.push(`${browser[1]} ${browser[2].split('.')[0]}`);
  if (os) parts.push(os[1].replace(' OS X', ''));
  return parts.length > 0 ? parts.join(' / ') : ua.substring(0, 40) + '…';
}

type SubTab = 'logins' | 'pageviews';

export default function UserActivityLog({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<SubTab>('logins');

  return (
    <div>
      <div className="border-b border-beige px-6 pt-4">
        <nav className="flex gap-4">
          {(['logins', 'pageviews'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`pb-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                subTab === t
                  ? 'border-gold text-dark-brown'
                  : 'border-transparent text-taupe hover:text-dark-brown'
              }`}
            >
              {t === 'logins' ? 'Login History' : 'Page Views'}
            </button>
          ))}
        </nav>
      </div>
      {subTab === 'logins' && <LoginHistory userId={userId} />}
      {subTab === 'pageviews' && <PageViewHistory userId={userId} />}
    </div>
  );
}

function LoginHistory({ userId }: { userId: string }) {
  const [data, setData] = useState<PaginatedResponse<LoginEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/admin/users/${userId}?include=logins&page=${page}&limit=15`))
      .then((res) => res.json())
      .then((json) => setData(json.logins))
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading) return <div className="p-6 text-sm text-taupe">Loading…</div>;
  if (!data || data.data.length === 0) return <div className="p-6 text-sm text-taupe">No login history yet.</div>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige text-left">
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Date</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">IP</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Location</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Browser</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Method</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((login) => (
              <tr key={login.id} className="border-b border-beige/50 hover:bg-cream/30">
                <td className="px-6 py-3 text-dark-brown whitespace-nowrap">
                  {new Date(login.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-3 text-dark-brown font-mono text-xs">
                  {login.ipAddress || '—'}
                </td>
                <td className="px-6 py-3 text-dark-brown whitespace-nowrap">
                  {login.countryCode ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-base leading-none">{countryFlag(login.countryCode)}</span>
                      <span>{login.city ? `${login.city}, ${login.countryCode}` : login.countryCode}</span>
                    </span>
                  ) : (
                    <span className="text-taupe">—</span>
                  )}
                </td>
                <td className="px-6 py-3 text-dark-brown text-xs">
                  {parseUA(login.userAgent)}
                </td>
                <td className="px-6 py-3">
                  <span className="text-xs text-taupe capitalize">{login.loginMethod}</span>
                </td>
                <td className="px-6 py-3">
                  {login.success ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700" title={login.failReason || undefined}>
                      Failed{login.failReason ? `: ${login.failReason.replace(/_/g, ' ')}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
    </div>
  );
}

function PageViewHistory({ userId }: { userId: string }) {
  const [data, setData] = useState<PaginatedResponse<PageViewEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/admin/users/${userId}?include=activity&page=${page}&limit=30`))
      .then((res) => res.json())
      .then((json) => setData(json.activity))
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading) return <div className="p-6 text-sm text-taupe">Loading…</div>;
  if (!data || data.data.length === 0) return <div className="p-6 text-sm text-taupe">No page views yet.</div>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige text-left">
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Date</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">Path</th>
              <th className="px-6 py-3 text-xs font-semibold text-taupe uppercase">IP</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((view) => (
              <tr key={view.id} className="border-b border-beige/50 hover:bg-cream/30">
                <td className="px-6 py-3 text-dark-brown whitespace-nowrap">
                  {new Date(view.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-3 text-dark-brown font-mono text-xs">
                  {view.path}
                </td>
                <td className="px-6 py-3 text-dark-brown font-mono text-xs">
                  {view.ipAddress || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
    </div>
  );
}

