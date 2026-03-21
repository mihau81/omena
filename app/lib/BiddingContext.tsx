/**
 * BiddingContext — global client-side state for the live bidding experience.
 *
 * Provides a single React context that handles:
 *  - Fetching and caching the bid history for whichever lot detail page is active.
 *  - Receiving real-time bid and timer updates via SSE (delegated to useRealtimeBids).
 *  - Optimistic updates: toggle-watch updates the UI immediately, then syncs with the
 *    API; on failure the optimistic change is reverted.
 *  - The server is always authoritative for bid amounts — after placing a bid or
 *    receiving an SSE event, the context re-fetches from /api/lots/{id}/bids rather
 *    than deriving state locally, to avoid drift from system (proxy) bids.
 *  - Soft-close (anti-sniping) end-time tracking: the context adjusts the displayed
 *    auction end time client-side when a bid lands in the closing window.
 */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { BidRecord } from './types';
import type { BidEvent } from '@/lib/bid-events';
import { useRealtimeBids } from './useRealtimeBids';
import { apiUrl } from './utils';
import {
  SOFT_CLOSE_WINDOW_MS,
  SOFT_CLOSE_EXTENSION_MS,
} from './bidding';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface BiddingState {
  // Lot-specific bid data (set when a lot detail page mounts)
  bids: BidRecord[];
  currentHighestBid: number | null;
  nextMinBid: number | null;
  totalBids: number;
  bidsLoading: boolean;

  // SSE subscription
  subscribeLot: (lotId: string, auctionId: string) => void;
  unsubscribeLot: () => void;

  // Actions
  placeBid: (lotId: string, auctionSlug: string, amount: number) => Promise<{ bid: { id: string; amount: number; isWinning: boolean; createdAt: string }; nextMinBid: number }>;
  toggleWatch: (lotId: string) => void;

  // Queries
  getBidsForLot: (lotId: string) => BidRecord[];
  getHighestBid: (lotId: string) => number | null;
  isUserWinning: (lotId: string) => boolean;
  getUserBids: () => UserBidSummary[];
  isLotWatched: (lotId: string) => boolean;
  getAuctionEndTime: (auctionSlug: string) => number | null;

  // Soft-close end times
  auctionEndTimes: Record<string, number>;

  // User bid count for header badge
  userBidsCount: number;
}

interface UserBidSummary {
  lotId: string;
  bidAmount: number;
  isWinning: boolean;
  bidCreatedAt: string;
}

const BiddingContext = createContext<BiddingState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface BiddingProviderProps {
  children: React.ReactNode;
  initialAuctionEndTimes?: Record<string, number>;
}

export function BiddingProvider({ children, initialAuctionEndTimes }: BiddingProviderProps) {
  const { data: session } = useSession();

  // ---- Lot-specific state (one lot at a time on detail page) ----
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [currentHighestBid, setCurrentHighestBid] = useState<number | null>(null);
  const [nextMinBidState, setNextMinBid] = useState<number | null>(null);
  const [totalBids, setTotalBids] = useState(0);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [subscribedLotId, setSubscribedLotId] = useState<string | null>(null);
  const [subscribedAuctionId, setSubscribedAuctionId] = useState<string | null>(null);

  // ---- Global state ----
  const [watchedLotIds, setWatchedLotIds] = useState<Set<string>>(new Set());
  const [userBidsList, setUserBidsList] = useState<UserBidSummary[]>([]);
  const [auctionEndTimes, setAuctionEndTimes] = useState<Record<string, number>>({});
  const watchedFetched = useRef(false);
  const userBidsFetched = useRef(false);

  // ---- Fetch favorites on session change ----
  useEffect(() => {
    if (!session?.user || session.user.userType !== 'user') {
      setWatchedLotIds(new Set());
      watchedFetched.current = false;
      return;
    }
    if (watchedFetched.current) return;
    watchedFetched.current = true;

    fetch(apiUrl('/api/me/favorites'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.favorites) {
          setWatchedLotIds(new Set(data.favorites.map((f: { lotId: string }) => f.lotId)));
        }
      })
      .catch(() => {});
  }, [session]);

  // ---- Fetch user bids on session change ----
  useEffect(() => {
    if (!session?.user || session.user.userType !== 'user') {
      setUserBidsList([]);
      userBidsFetched.current = false;
      return;
    }
    if (userBidsFetched.current) return;
    userBidsFetched.current = true;

    fetch(apiUrl('/api/user/bids'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.bids) {
          setUserBidsList(
            data.bids.map((b: { lotId: string; bidAmount: number; isWinning: boolean; bidCreatedAt: string }) => ({
              lotId: b.lotId,
              bidAmount: b.bidAmount,
              isWinning: b.isWinning,
              bidCreatedAt: b.bidCreatedAt,
            })),
          );
        }
      })
      .catch(() => {});
  }, [session]);

  // ---- Initialize auction end times from server ----
  useEffect(() => {
    if (!initialAuctionEndTimes) return;
    setAuctionEndTimes((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const [slug, endTime] of Object.entries(initialAuctionEndTimes)) {
        if (!updated[slug]) {
          updated[slug] = endTime;
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }, [initialAuctionEndTimes]);

  // ---- Fetch bids for subscribed lot ----
  const fetchBidsForLot = useCallback(
    async (lotId: string) => {
      setBidsLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/lots/${lotId}/bids`));
        if (!res.ok) return;
        const data = await res.json();
        const records: BidRecord[] = (data.bids || []).map(
          (b: { id: string; amount: number; paddleNumber: number | null; bidType: string; isWinning: boolean; isRetracted: boolean; createdAt: string }) => ({
            id: b.id,
            lotId,
            amount: b.amount,
            paddleNumber: b.paddleNumber,
            bidType: b.bidType,
            isWinning: b.isWinning,
            isRetracted: b.isRetracted,
            createdAt: b.createdAt,
            // GET /bids returns anonymized records (no userId) — isUser is resolved
            // from the separate userBidsList which is populated after login.
            isUser: false,
          }),
        );
        setBids(records);
        setCurrentHighestBid(data.currentHighestBid);
        setNextMinBid(data.nextMinBid);
        setTotalBids(data.totalBids);
      } catch {
        // Silently fail
      } finally {
        setBidsLoading(false);
      }
    },
    [],
  );

  // ---- Subscribe/unsubscribe to lot ----
  const subscribeLot = useCallback(
    (lotId: string, auctionId: string) => {
      setSubscribedLotId(lotId);
      setSubscribedAuctionId(auctionId);
      fetchBidsForLot(lotId);
    },
    [fetchBidsForLot],
  );

  const unsubscribeLot = useCallback(() => {
    setSubscribedLotId(null);
    setSubscribedAuctionId(null);
    setBids([]);
    setCurrentHighestBid(null);
    setNextMinBid(null);
    setTotalBids(0);
  }, []);

  // ---- SSE: real-time bid updates ----
  // On an SSE bid event we re-fetch rather than applying the event payload directly.
  // This keeps the list consistent with system (proxy) bids that may have been placed
  // in the same transaction and weren't emitted as separate events.
  const handleBidEvent = useCallback(
    (event: BidEvent) => {
      if (subscribedLotId && event.lotId === subscribedLotId) {
        // Refetch bids to get fresh data
        fetchBidsForLot(subscribedLotId);
      }
    },
    [subscribedLotId, fetchBidsForLot],
  );

  useRealtimeBids({
    auctionId: subscribedAuctionId,
    lotId: subscribedLotId,
    onBid: handleBidEvent,
  });

  // ---- Soft close helper ----
  const applySoftClose = useCallback((auctionSlug: string) => {
    setAuctionEndTimes((prev) => {
      const currentEnd = prev[auctionSlug];
      if (!currentEnd) return prev;
      const now = Date.now();
      const remaining = currentEnd - now;
      if (remaining > 0 && remaining <= SOFT_CLOSE_WINDOW_MS) {
        return { ...prev, [auctionSlug]: now + SOFT_CLOSE_EXTENSION_MS };
      }
      return prev;
    });
  }, []);

  // ---- Place bid (async, calls real API) ----
  const placeBid = useCallback(
    async (lotId: string, auctionSlug: string, amount: number) => {
      const res = await fetch(apiUrl(`/api/lots/${lotId}/bids`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Bid failed' }));
        throw new Error(data.error || 'Bid failed');
      }

      const data = await res.json();

      // Update local state immediately with the new bid
      if (subscribedLotId === lotId) {
        setCurrentHighestBid(data.bid.amount);
        setNextMinBid(data.nextMinBid);
        // Refetch to get full bid list
        fetchBidsForLot(lotId);
      }

      // Update user bids count
      setUserBidsList((prev) => {
        const existing = prev.find((b) => b.lotId === lotId);
        if (existing) {
          return prev.map((b) =>
            b.lotId === lotId
              ? { ...b, bidAmount: data.bid.amount, isWinning: data.bid.isWinning, bidCreatedAt: data.bid.createdAt }
              : b,
          );
        }
        return [
          ...prev,
          { lotId, bidAmount: data.bid.amount, isWinning: data.bid.isWinning, bidCreatedAt: data.bid.createdAt },
        ];
      });

      // Soft close check
      applySoftClose(auctionSlug);

      return data;
    },
    [subscribedLotId, fetchBidsForLot, applySoftClose],
  );

  // ---- Toggle watch (optimistic + API) ----
  const toggleWatch = useCallback(
    (lotId: string) => {
      const isCurrentlyWatched = watchedLotIds.has(lotId);

      // Optimistic update
      setWatchedLotIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyWatched) {
          next.delete(lotId);
        } else {
          next.add(lotId);
        }
        return next;
      });

      // API call
      const method = isCurrentlyWatched ? 'DELETE' : 'POST';
      fetch(apiUrl('/api/me/favorites'), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotId }),
      }).catch(() => {
        // Revert on failure
        setWatchedLotIds((prev) => {
          const next = new Set(prev);
          if (isCurrentlyWatched) {
            next.add(lotId);
          } else {
            next.delete(lotId);
          }
          return next;
        });
      });
    },
    [watchedLotIds],
  );

  // ---- Queries ----
  const getBidsForLot = useCallback(
    (lotId: string): BidRecord[] => {
      if (lotId !== subscribedLotId) return [];
      return [...bids].sort((a, b) => b.amount - a.amount);
    },
    [bids, subscribedLotId],
  );

  const getHighestBid = useCallback(
    (lotId: string): number | null => {
      if (lotId !== subscribedLotId) return null;
      return currentHighestBid;
    },
    [subscribedLotId, currentHighestBid],
  );

  const isUserWinning = useCallback(
    (lotId: string): boolean => {
      if (!currentHighestBid) return false;
      // Compare user's highest bid amount with current highest
      const userBid = userBidsList.find((b) => b.lotId === lotId);
      if (!userBid) return false;
      return userBid.bidAmount >= currentHighestBid;
    },
    [currentHighestBid, userBidsList],
  );

  const getUserBids = useCallback((): UserBidSummary[] => {
    return userBidsList;
  }, [userBidsList]);

  const isLotWatched = useCallback(
    (lotId: string): boolean => {
      return watchedLotIds.has(lotId);
    },
    [watchedLotIds],
  );

  const getAuctionEndTime = useCallback(
    (auctionSlug: string): number | null => {
      return auctionEndTimes[auctionSlug] ?? null;
    },
    [auctionEndTimes],
  );

  const value: BiddingState = {
    bids,
    currentHighestBid,
    nextMinBid: nextMinBidState,
    totalBids,
    bidsLoading,
    subscribeLot,
    unsubscribeLot,
    placeBid,
    toggleWatch,
    getBidsForLot,
    getHighestBid,
    isUserWinning,
    getUserBids,
    isLotWatched,
    getAuctionEndTime,
    auctionEndTimes,
    userBidsCount: userBidsList.length,
  };

  return (
    <BiddingContext.Provider value={value}>
      {children}
    </BiddingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBidding(): BiddingState {
  const ctx = useContext(BiddingContext);
  if (!ctx) throw new Error('useBidding must be used within BiddingProvider');
  return ctx;
}
