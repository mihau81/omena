'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export default function AccountNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/me/notifications'))
      .then((res) => (res.ok ? res.json() : { notifications: [], unreadCount: 0 }))
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(apiUrl(`/api/me/notifications/${id}/read`), { method: 'POST' });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch(apiUrl('/api/me/notifications/read-all'), { method: 'POST' });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-gold">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-gold hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-taupe">No notifications yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => !notif.isRead && markAsRead(notif.id)}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                notif.isRead
                  ? 'border-beige bg-white'
                  : 'border-gold/30 bg-gold/5 hover:bg-gold/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!notif.isRead && (
                      <span className="inline-block h-2 w-2 rounded-full bg-gold shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${notif.isRead ? 'text-dark-brown' : 'text-dark-brown'}`}>
                      {notif.title}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-taupe line-clamp-2">{notif.body}</p>
                </div>
                <span className="shrink-0 text-xs text-taupe">{timeAgo(notif.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
