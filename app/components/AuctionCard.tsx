import Link from "next/link";
import type { Auction } from "../lib/types";
import {
  formatDate,
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
} from "../lib/utils";

interface AuctionCardProps {
  auction: Auction;
}

export default function AuctionCard({ auction }: AuctionCardProps) {
  return (
    <Link
      href={`/auctions/${auction.slug}`}
      className="group block overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-beige" role="img" aria-label={auction.title}>
        <div className="flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-105">
          <div className="absolute inset-0 bg-gold/10" />
          <span className="relative font-serif text-lg text-taupe" aria-hidden="true">
            {auction.title}
          </span>
        </div>

        {/* Status badge */}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(auction.status)}`}
        >
          {getStatusLabel(auction.status)}
        </span>

        {/* Category badge */}
        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-xs text-taupe backdrop-blur-sm">
          {getCategoryLabel(auction.category)}
        </span>
      </div>

      {/* Content area */}
      <div className="rounded-b-xl bg-white p-5">
        <h3 className="line-clamp-2 font-serif text-lg font-bold text-dark-brown">
          {auction.title}
        </h3>
        <p className="mt-1 text-sm text-taupe">{formatDate(auction.date)}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-taupe">
            {auction.totalLots} obiekt&oacute;w
          </span>
          <span className="truncate text-sm text-taupe">
            {auction.location}
          </span>
        </div>
      </div>
    </Link>
  );
}
