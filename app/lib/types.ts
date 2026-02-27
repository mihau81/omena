export interface Auction {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  endDate: string;
  status: 'upcoming' | 'live' | 'ended';
  category: 'malarstwo' | 'rzezba' | 'fotografia' | 'mixed';
  coverImage: string;
  totalLots: number;
  location: string;
  curator: string;
}

export interface Lot {
  id: string;
  auctionSlug: string;
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: number;
  estimateMin: number;
  estimateMax: number;
  currentBid: number | null;
  images: string[];
  provenance: string[];
  exhibited: string[];
  lotNumber: number;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
  type: 'auction' | 'exhibition' | 'gala';
}

export interface PressItem {
  id: string;
  title: string;
  source: string;
  date: string;
  excerpt: string;
  url: string;
  image: string;
}

export interface Stats {
  totalAuctions: number;
  totalLots: number;
  totalArtists: number;
  totalRaised: string;
}

export interface BidRecord {
  id: string;
  lotId: string;
  auctionSlug: string;
  amount: number;
  bidderId: string;
  bidderLabel: string;
  timestamp: number;
  isUser: boolean;
}

export interface BidderRegistration {
  id: string;
  name: string;
  email: string;
  phone: string;
  paddleNumber: number;
  registeredAt: number;
  acceptedTerms: boolean;
}

export interface WatchedLot {
  lotId: string;
  auctionSlug: string;
  addedAt: number;
}

export interface AuctionEndResult {
  lotId: string;
  sold: boolean;
  hammerPrice: number | null;
  winningBidderId: string | null;
}
