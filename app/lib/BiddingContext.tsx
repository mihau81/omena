'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { BidRecord, BidderRegistration, WatchedLot } from './types';
import { lots, auctions } from './data';
import {
  generateBidderId,
  generatePaddleNumber,
  generateBotBidderLabel,
  getNextMinBid,
  shouldBotCounterBid,
  getBotResponseDelay,
  SOFT_CLOSE_WINDOW_MS,
  SOFT_CLOSE_EXTENSION_MS,
} from './bidding';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'omena_';
const KEY_REGISTRATION = STORAGE_PREFIX + 'registration';
const KEY_BIDS = STORAGE_PREFIX + 'bids';
const KEY_WATCHED = STORAGE_PREFIX + 'watched';
const KEY_END_TIMES = STORAGE_PREFIX + 'end_times';
const KEY_SEEDED = STORAGE_PREFIX + 'seeded';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface BiddingState {
  registration: BidderRegistration | null;
  bids: BidRecord[];
  watchedLots: WatchedLot[];
  auctionEndTimes: Record<string, number>;

  register: (name: string, email: string, phone: string) => void;
  placeBid: (lotId: string, auctionSlug: string, amount: number) => void;
  toggleWatch: (lotId: string, auctionSlug: string) => void;
  getBidsForLot: (lotId: string) => BidRecord[];
  getHighestBid: (lotId: string) => number | null;
  isUserWinning: (lotId: string) => boolean;
  isUserRegistered: () => boolean;
  getAuctionEndTime: (auctionSlug: string) => number | null;
  getUserBids: () => BidRecord[];
  isLotWatched: (lotId: string) => boolean;
}

const BiddingContext = createContext<BiddingState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function BiddingProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<BidderRegistration | null>(null);
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [watchedLots, setWatchedLots] = useState<WatchedLot[]>([]);
  const [auctionEndTimes, setAuctionEndTimes] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  const botTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ---- hydrate from localStorage on mount ----
  useEffect(() => {
    setRegistration(loadJSON<BidderRegistration | null>(KEY_REGISTRATION, null));
    setWatchedLots(loadJSON<WatchedLot[]>(KEY_WATCHED, []));
    setAuctionEndTimes(loadJSON<Record<string, number>>(KEY_END_TIMES, {}));

    // Seed initial bids from data.ts currentBid values (only once)
    const alreadySeeded = loadJSON<boolean>(KEY_SEEDED, false);
    const existingBids = loadJSON<BidRecord[]>(KEY_BIDS, []);

    if (!alreadySeeded) {
      const seededBids: BidRecord[] = [];
      for (const lot of lots) {
        if (lot.currentBid !== null) {
          seededBids.push({
            id: 'seed-' + lot.id,
            lotId: lot.id,
            auctionSlug: lot.auctionSlug,
            amount: lot.currentBid,
            bidderId: 'bot-seed-' + lot.id,
            bidderLabel: generateBotBidderLabel(),
            timestamp: Date.now() - 3600000 + Math.random() * 1800000,
            isUser: false,
          });
        }
      }
      const merged = [...seededBids, ...existingBids];
      setBids(merged);
      saveJSON(KEY_BIDS, merged);
      saveJSON(KEY_SEEDED, true);
    } else {
      setBids(existingBids);
    }

    setHydrated(true);
  }, []);

  // ---- persist on change (skip before hydration) ----
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(KEY_REGISTRATION, registration);
  }, [registration, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(KEY_BIDS, bids);
  }, [bids, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(KEY_WATCHED, watchedLots);
  }, [watchedLots, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(KEY_END_TIMES, auctionEndTimes);
  }, [auctionEndTimes, hydrated]);

  // ---- cross-tab sync ----
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY_REGISTRATION) setRegistration(loadJSON(KEY_REGISTRATION, null));
      if (e.key === KEY_BIDS) setBids(loadJSON(KEY_BIDS, []));
      if (e.key === KEY_WATCHED) setWatchedLots(loadJSON(KEY_WATCHED, []));
      if (e.key === KEY_END_TIMES) setAuctionEndTimes(loadJSON(KEY_END_TIMES, {}));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ---- cleanup bot timers ----
  useEffect(() => {
    return () => {
      botTimers.current.forEach(clearTimeout);
    };
  }, []);

  // ---- soft close helper ----
  const applySoftClose = useCallback(
    (auctionSlug: string) => {
      setAuctionEndTimes((prev) => {
        const currentEnd = prev[auctionSlug];
        if (!currentEnd) return prev;
        const now = Date.now();
        const remaining = currentEnd - now;
        if (remaining > 0 && remaining <= SOFT_CLOSE_WINDOW_MS) {
          const newEnd = now + SOFT_CLOSE_EXTENSION_MS;
          const updated = { ...prev, [auctionSlug]: newEnd };
          saveJSON(KEY_END_TIMES, updated);
          return updated;
        }
        return prev;
      });
    },
    [],
  );

  // ---- register ----
  const register = useCallback((name: string, email: string, phone: string) => {
    const reg: BidderRegistration = {
      id: generateBidderId(),
      name,
      email,
      phone,
      paddleNumber: generatePaddleNumber(),
      registeredAt: Date.now(),
      acceptedTerms: true,
    };
    setRegistration(reg);
  }, []);

  // ---- place bid ----
  const placeBid = useCallback(
    (lotId: string, auctionSlug: string, amount: number) => {
      if (!registration) return;

      const bid: BidRecord = {
        id: 'bid-' + Math.random().toString(36).substring(2, 10),
        lotId,
        auctionSlug,
        amount,
        bidderId: registration.id,
        bidderLabel: `Licytant #${registration.paddleNumber}`,
        timestamp: Date.now(),
        isUser: true,
      };

      setBids((prev) => {
        const updated = [...prev, bid];
        saveJSON(KEY_BIDS, updated);
        return updated;
      });

      // Soft close check
      applySoftClose(auctionSlug);

      // Simulated competitor response
      if (shouldBotCounterBid()) {
        const delay = getBotResponseDelay();
        const timer = setTimeout(() => {
          const counterAmount = getNextMinBid(amount);
          const botBid: BidRecord = {
            id: 'bid-' + Math.random().toString(36).substring(2, 10),
            lotId,
            auctionSlug,
            amount: counterAmount,
            bidderId: 'bot-' + Math.random().toString(36).substring(2, 8),
            bidderLabel: generateBotBidderLabel(),
            timestamp: Date.now(),
            isUser: false,
          };
          setBids((prev) => {
            const updated = [...prev, botBid];
            saveJSON(KEY_BIDS, updated);
            return updated;
          });
          applySoftClose(auctionSlug);
        }, delay);
        botTimers.current.push(timer);
      }
    },
    [registration, applySoftClose],
  );

  // ---- toggle watch ----
  const toggleWatch = useCallback((lotId: string, auctionSlug: string) => {
    setWatchedLots((prev) => {
      const exists = prev.some((w) => w.lotId === lotId);
      const updated = exists
        ? prev.filter((w) => w.lotId !== lotId)
        : [...prev, { lotId, auctionSlug, addedAt: Date.now() }];
      saveJSON(KEY_WATCHED, updated);
      return updated;
    });
  }, []);

  // ---- queries ----
  const getBidsForLot = useCallback(
    (lotId: string): BidRecord[] => {
      return bids
        .filter((b) => b.lotId === lotId)
        .sort((a, b) => b.amount - a.amount);
    },
    [bids],
  );

  const getHighestBid = useCallback(
    (lotId: string): number | null => {
      const lotBids = bids.filter((b) => b.lotId === lotId);
      if (lotBids.length === 0) return null;
      return Math.max(...lotBids.map((b) => b.amount));
    },
    [bids],
  );

  const isUserWinning = useCallback(
    (lotId: string): boolean => {
      if (!registration) return false;
      const lotBids = bids.filter((b) => b.lotId === lotId);
      if (lotBids.length === 0) return false;
      const highest = lotBids.reduce((max, b) => (b.amount > max.amount ? b : max), lotBids[0]);
      return highest.bidderId === registration.id;
    },
    [bids, registration],
  );

  const isUserRegistered = useCallback((): boolean => {
    return registration !== null;
  }, [registration]);

  const getAuctionEndTime = useCallback(
    (auctionSlug: string): number | null => {
      return auctionEndTimes[auctionSlug] ?? null;
    },
    [auctionEndTimes],
  );

  const getUserBids = useCallback((): BidRecord[] => {
    return bids.filter((b) => b.isUser).sort((a, b) => b.timestamp - a.timestamp);
  }, [bids]);

  const isLotWatched = useCallback(
    (lotId: string): boolean => {
      return watchedLots.some((w) => w.lotId === lotId);
    },
    [watchedLots],
  );

  // ---- Initialize auction end times from data on hydration ----
  useEffect(() => {
    if (!hydrated) return;
    setAuctionEndTimes((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const auction of auctions) {
        if (auction.status === 'live' && !updated[auction.slug]) {
          const endTime = new Date(auction.endDate).getTime();
          if (!isNaN(endTime)) {
            updated[auction.slug] = endTime;
            changed = true;
          }
        }
      }
      if (changed) {
        saveJSON(KEY_END_TIMES, updated);
      }
      return changed ? updated : prev;
    });
  }, [hydrated]);

  const value: BiddingState = {
    registration,
    bids,
    watchedLots,
    auctionEndTimes,
    register,
    placeBid,
    toggleWatch,
    getBidsForLot,
    getHighestBid,
    isUserWinning,
    isUserRegistered,
    getAuctionEndTime,
    getUserBids,
    isLotWatched,
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
