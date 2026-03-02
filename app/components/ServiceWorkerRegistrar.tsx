'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for Web Push support.
 * Rendered once in the root layout — no visible output.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] Registration failed:', err);
      });
    }
  }, []);

  return null;
}
