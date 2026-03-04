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

export interface ConditionPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  originalFilename: string | null;
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
  status?: string;
  closingAt?: string | null;
  auctionId?: string;
  conditionGrade?: string | null;
  conditionNotes?: string | null;
  conditionPhotos?: ConditionPhoto[];
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
  amount: number;
  paddleNumber: number | null;
  bidType: string;         // 'online' | 'phone' | 'absentee'
  isWinning: boolean;
  isRetracted: boolean;
  createdAt: string;       // ISO date
  isUser: boolean;         // computed client-side
}

export interface AuctionEndResult {
  lotId: string;
  sold: boolean;
  hammerPrice: number | null;
  winningBidderId: string | null;
}
