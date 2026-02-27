import Link from "next/link";
import type { Lot } from "../lib/types";
import { formatPrice } from "../lib/utils";

interface LotCardProps {
  lot: Lot;
  auctionSlug: string;
}

export default function LotCard({ lot, auctionSlug }: LotCardProps) {
  return (
    <Link
      href={`/auctions/${auctionSlug}/${lot.id}`}
      className="group block overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden rounded-t-xl bg-beige" role="img" aria-label={`${lot.title} — ${lot.artist}`}>
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-serif text-3xl text-taupe/40" aria-hidden="true">
            {lot.lotNumber}
          </span>
        </div>

        {/* Lot number badge */}
        <span className="absolute left-3 top-3 rounded bg-dark-brown/80 px-2 py-1 text-xs font-medium text-white">
          Lot {lot.lotNumber}
        </span>
      </div>

      {/* Content area */}
      <div className="rounded-b-xl bg-white p-4">
        <h3 className="line-clamp-1 font-serif text-base font-bold text-dark-brown">
          {lot.title}
        </h3>
        <p className="mt-1 text-sm text-gold">{lot.artist}</p>
        <p className="mt-0.5 text-xs text-taupe">{lot.year}</p>
        <p className="mt-2 text-sm text-taupe">
          Estymata: {formatPrice(lot.estimateMin)} &ndash;{" "}
          {formatPrice(lot.estimateMax)}
        </p>
        {lot.currentBid && (
          <p className="mt-1 text-sm font-medium text-gold">
            Aktualna oferta: {formatPrice(lot.currentBid)}
          </p>
        )}
      </div>
    </Link>
  );
}
