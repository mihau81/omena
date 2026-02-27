import Image from "next/image";
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
        <Image
          src={auction.coverImage}
          alt={auction.title}
          width={800}
          height={600}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

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
