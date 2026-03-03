'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

type State = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export default function PushNotificationToggle() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    // Check if already subscribed via our API
    fetch(apiUrl('/api/me/push-subscription'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.isSubscribed) {
          setState('subscribed');
        } else {
          setState('unsubscribed');
        }
      })
      .catch(() => setState('unsubscribed'));
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      // Get VAPID public key
      const keyRes = await fetch(apiUrl('/api/me/push-subscription'));
      if (!keyRes.ok) return;
      const { vapidPublicKey } = await keyRes.json();

      if (!vapidPublicKey) {
        console.warn('[push] VAPID public key not configured');
        return;
      }

      // Request browser permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      // Register service worker
      const reg = await navigator.serviceWorker.register('/omenaa/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
      });

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      // Save to server
      const saveRes = await fetch(apiUrl('/api/me/push-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson),
      });

      if (saveRes.ok) {
        setState('subscribed');
      }
    } catch (err) {
      console.error('[push] Subscribe error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/omenaa/sw.js');
      const sub = await reg?.pushManager.getSubscription();

      if (sub) {
        // Remove from server first
        await fetch(apiUrl('/api/me/push-subscription'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }

      setState('unsubscribed');
    } catch (err) {
      console.error('[push] Unsubscribe error:', err);
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3">
        <div className="h-5 w-10 animate-pulse rounded-full bg-beige" />
        <span className="text-sm text-taupe">Sprawdzanie...</span>
      </div>
    );
  }

  if (state === 'unsupported') {
    return (
      <p className="text-sm text-taupe">
        Twoja przeglądarka nie obsługuje powiadomień push.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <p className="text-sm text-taupe">
        Powiadomienia zablokowane. Odblokuj je w ustawieniach przeglądarki.
      </p>
    );
  }

  const isSubscribed = state === 'subscribed';

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-dark-brown">Powiadomienia push</p>
        <p className="text-xs text-taupe mt-0.5">
          {isSubscribed
            ? 'Otrzymujesz powiadomienia o podbiciach i wygranych lotach.'
            : 'Włącz, aby otrzymywać powiadomienia o podbiciach i wygranych lotach.'}
        </p>
      </div>
      <button
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={busy}
        aria-pressed={isSubscribed}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:opacity-50 ${
          isSubscribed ? 'bg-gold' : 'bg-taupe/30'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
            isSubscribed ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
