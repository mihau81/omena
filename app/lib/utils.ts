import type { Auction } from './types';
import { auctions, lots } from './data';

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
