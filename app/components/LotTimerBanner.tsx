'use client';

import { useState, useEffect, useRef } from 'react';

interface LotTimerBannerProps {
  lotId: string;
  auctionId: string;
  initialClosingAt: string | null;
}

export default function LotTimerBanner({
  lotId,
  auctionId,
  initialClosingAt,
}: LotTimerBannerProps) {
  const [closingAt, setClosingAt] = useState<string | null>(initialClosingAt);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Update the countdown from the closingAt timestamp
  useEffect(() => {
    if (!closingAt) {
      setSecondsLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(closingAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };

    tick();
    timerRef.current = setInterval(tick, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [closingAt]);

  // Subscribe to SSE timer events
  useEffect(() => {
    if (!auctionId) return;

    const es = new EventSource(`/api/sse/auction/${auctionId}`);
    sseRef.current = es;

    es.addEventListener('lot:timer:start', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { lotId: string; closingAt: string };
      if (data.lotId === lotId) {
        setClosingAt(data.closingAt);
      }
    });

    es.addEventListener('lot:timer:extend', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { lotId: string; newClosingAt: string };
      if (data.lotId === lotId) {
        setClosingAt(data.newClosingAt);
      }
    });

    es.addEventListener('lot:timer:expired', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { lotId: string };
      if (data.lotId === lotId) {
        setClosingAt(null);
        setSecondsLeft(0);
      }
    });

    es.addEventListener('lot:timer:stopped', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { lotId: string };
      if (data.lotId === lotId) {
        setClosingAt(null);
        setSecondsLeft(null);
      }
    });

    return () => {
      es.close();
    };
  }, [auctionId, lotId]);

  if (secondsLeft === null || !closingAt) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const isUrgent = secondsLeft <= 10;
  const isWarning = secondsLeft > 10 && secondsLeft <= 30;
  const isExpired = secondsLeft === 0;

  return (
    <div
      className={`rounded-xl px-5 py-4 mb-4 flex items-center justify-between transition-all ${
        isExpired
          ? 'bg-gray-100 border border-gray-200'
          : isUrgent
          ? 'bg-red-50 border border-red-300 animate-pulse'
          : isWarning
          ? 'bg-amber-50 border border-amber-300'
          : 'bg-emerald-50 border border-emerald-200'
      }`}
    >
      <div>
        {isExpired ? (
          <p className="text-sm font-semibold text-gray-600">Bidding closed</p>
        ) : (
          <>
            <p
              className={`text-xs font-medium uppercase tracking-wide ${
                isUrgent ? 'text-red-600' : isWarning ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {isUrgent
                ? 'Closing now!'
                : isWarning
                ? 'Going, going…'
                : 'Lot closing in'}
            </p>
            <p
              className={`mt-0.5 font-mono text-3xl font-bold tabular-nums ${
                isUrgent ? 'text-red-700' : isWarning ? 'text-amber-800' : 'text-emerald-800'
              }`}
            >
              {display}
            </p>
          </>
        )}
      </div>
      {!isExpired && (
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isUrgent
              ? 'bg-red-100 text-red-600'
              : isWarning
              ? 'bg-amber-100 text-amber-600'
              : 'bg-emerald-100 text-emerald-600'
          }`}
        >
          {/* Clock icon */}
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" />
          </svg>
        </div>
      )}
    </div>
  );
}
