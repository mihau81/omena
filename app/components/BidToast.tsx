'use client';

import { useEffect, useState, useCallback } from 'react';

type ToastType = 'success' | 'outbid' | 'extended';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const TOAST_EVENT = 'omena-toast';
const DISMISS_MS = 4000;

export function showBidToast(type: ToastType, message: string) {
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, { detail: { type, message } }),
  );
}

const icons: Record<ToastType, string> = {
  success: '✓',
  outbid: '⚠',
  extended: '⏱',
};

const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    text: 'text-green-800',
    icon: 'bg-green-500 text-white',
  },
  outbid: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-800',
    icon: 'bg-amber-500 text-white',
  },
  extended: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-800',
    icon: 'bg-blue-500 text-white',
  },
};

export default function BidToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    function handleToast(e: Event) {
      const { type, message } = (e as CustomEvent).detail as {
        type: ToastType;
        message: string;
      };
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), DISMISS_MS);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map((toast) => {
        const c = colors[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-lg border ${c.border} ${c.bg} px-4 py-3 shadow-lg animate-in slide-in-from-right`}
            style={{ animation: 'slideInRight 0.3s ease-out' }}
            role="alert"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${c.icon}`}
            >
              {icons[toast.type]}
            </span>
            <p className={`text-sm font-medium ${c.text}`}>{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className={`ml-2 shrink-0 text-lg leading-none opacity-60 hover:opacity-100 ${c.text}`}
              aria-label="Zamknij"
            >
              &times;
            </button>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
