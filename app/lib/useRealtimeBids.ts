'use client';

import { apiUrl } from '@/app/lib/utils';

import { useEffect, useRef } from 'react';
import type { BidEvent } from '@/lib/bid-events';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseRealtimeBidsOptions {
  /** Auction ID to subscribe to. Pass null/undefined to skip. */
  auctionId: string | null | undefined;
  /** Optional lot ID used for polling fallback in browsers without EventSource. */
  lotId?: string | null;
  /** Called when a new bid event is received. */
  onBid: (event: BidEvent) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Subscribes to live bid updates for an auction via SSE.
 * Falls back to 5-second polling (using the lot bids API) if EventSource
 * is not available in the current browser.
 */
export function useRealtimeBids({
  auctionId,
  lotId,
  onBid,
}: UseRealtimeBidsOptions): void {
  // Keep a stable ref to the callback so we don't need to reconnect on re-renders
  const onBidRef = useRef(onBid);
  onBidRef.current = onBid;

  useEffect(() => {
    if (!auctionId) return;

    let destroyed = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    function cleanup() {
      destroyed = true;
      es?.close();
      es = null;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function connectSSE() {
      if (destroyed) return;

      es = new EventSource(apiUrl(`/api/sse/auction/${auctionId}`));

      es.addEventListener('connected', () => {
        retryCount = 0;
      });

      es.addEventListener('bid', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as BidEvent;
          onBidRef.current(data);
        } catch {
          // Ignore malformed events
        }
      });

      es.addEventListener('error', () => {
        es?.close();
        es = null;
        if (!destroyed) {
          // Exponential backoff: 1s → 2s → 4s → 8s → 10s max
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10_000);
          retryCount = Math.min(retryCount + 1, 4);
          reconnectTimer = setTimeout(connectSSE, delay);
        }
      });
    }

    function startPolling(currentLotId: string) {
      if (destroyed) return;

      let lastAmount: number | null = null;

      pollTimer = setInterval(async () => {
        if (destroyed) return;
        try {
          const res = await fetch(apiUrl(`/api/lots/${currentLotId}/bids`));
          if (!res.ok) return;
          const data = (await res.json()) as {
            currentHighestBid: number | null;
            nextMinBid: number;
          };
          if (
            data.currentHighestBid !== null &&
            data.currentHighestBid !== lastAmount
          ) {
            lastAmount = data.currentHighestBid;
            onBidRef.current({
              lotId: currentLotId,
              auctionId: auctionId!,
              amount: data.currentHighestBid,
              isWinning: true,
              timestamp: new Date().toISOString(),
              nextMinBid: data.nextMinBid,
            });
          }
        } catch {
          // Ignore polling errors
        }
      }, 5_000);
    }

    if (typeof EventSource !== 'undefined') {
      connectSSE();
    } else if (lotId) {
      startPolling(lotId);
    }

    return cleanup;
  }, [auctionId, lotId]);
}
