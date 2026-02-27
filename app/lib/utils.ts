import type { Auction } from './types';
import { auctions, lots } from './data';

// ---------------------------------------------------------------------------
// YouTube helpers
// ---------------------------------------------------------------------------

const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

export function isYouTubeUrl(url: string): boolean {
  return YT_REGEX.test(url);
}

export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(YT_REGEX);
  return match ? match[1] : null;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export function formatPrice(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' PLN';
}

const POLISH_MONTHS = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

export function formatDate(d: string): string {
  const date = new Date(d);
  const day = date.getDate();
  const month = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getStatusLabel(s: Auction['status']): string {
  switch (s) {
    case 'upcoming':
      return 'Nadchodząca';
    case 'live':
      return 'Trwająca';
    case 'ended':
      return 'Zakończona';
  }
}

export function getStatusColor(s: Auction['status']): string {
  switch (s) {
    case 'upcoming':
      return 'bg-blue-100 text-blue-800';
    case 'live':
      return 'bg-green-100 text-green-800';
    case 'ended':
      return 'bg-gray-100 text-gray-800';
  }
}

export function getCategoryLabel(c: Auction['category']): string {
  switch (c) {
    case 'malarstwo':
      return 'Malarstwo';
    case 'rzezba':
      return 'Rzeźba';
    case 'fotografia':
      return 'Fotografia';
    case 'mixed':
      return 'Kolekcja mieszana';
  }
}

export function getAuctionBySlug(slug: string): Auction | undefined {
  return auctions.find((a) => a.slug === slug);
}

export function getLotsByAuction(slug: string): typeof lots {
  return lots.filter((l) => l.auctionSlug === slug);
}

export function getLotById(
  auctionSlug: string,
  lotId: string,
): (typeof lots)[number] | undefined {
  return lots.find((l) => l.auctionSlug === auctionSlug && l.id === lotId);
}

export function formatPriceShort(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + ' mln PLN';
  if (n >= 1000) return Math.round(n / 1000) + ' tys. PLN';
  return n + ' PLN';
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
