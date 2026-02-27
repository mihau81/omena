import { Metadata } from "next";
import Link from "next/link";
import { auctions } from "../../lib/data";
import {
  getAuctionBySlug,
  getLotsByAuction,
  formatDate,
  getStatusLabel,
  getStatusColor,
} from "../../lib/utils";
import LotCard from "../../components/LotCard";
import Breadcrumbs from "../../components/Breadcrumbs";
import CountdownTimer from "../../components/CountdownTimer";

export function generateStaticParams() {
  return auctions.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const auction = getAuctionBySlug(slug);
    return {
      title: auction?.title ?? "Aukcja",
    };
  });
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auction = getAuctionBySlug(slug);

  if (!auction) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-16 text-center md:px-8">
        <h1 className="font-serif text-3xl font-bold text-dark-brown">
          Nie znaleziono aukcji
        </h1>
        <Link href="/auctions" className="mt-4 inline-block text-gold">
          Powr&oacute;t do listy aukcji
        </Link>
      </section>
    );
  }

  const auctionLots = getLotsByAuction(slug);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: "Strona g\u0142\u00f3wna", href: "/" },
          { label: "Aukcje", href: "/auctions" },
          { label: auction.title },
        ]}
      />

      {/* Auction hero */}
      <div className="mt-6 rounded-2xl bg-beige p-6 md:p-10">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(auction.status)}`}
        >
          {getStatusLabel(auction.status)}
        </span>

        <h1 className="mt-4 font-serif text-3xl font-bold text-dark-brown md:text-4xl">
          {auction.title}
        </h1>

        <p className="mt-2 text-taupe">Kurator: {auction.curator}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-taupe">
          <span>{formatDate(auction.date)}</span>
          <span>&middot;</span>
          <span>{auction.location}</span>
        </div>

        {(auction.status === "upcoming" || auction.status === "live") && (
          <div className="mt-6">
            <CountdownTimer
              targetDate={
                auction.status === "live" ? auction.endDate : auction.date
              }
            />
          </div>
        )}
      </div>

      {/* Description */}
      <p className="mt-8 max-w-3xl leading-relaxed text-taupe">
        {auction.description}
      </p>

      {/* Lots */}
      <div className="mt-12">
        <h2 className="font-serif text-2xl font-bold text-dark-brown">
          Obiekty ({auctionLots.length})
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {auctionLots.map((lot) => (
            <LotCard key={lot.id} lot={lot} auctionSlug={slug} />
          ))}
        </div>
      </div>
    </section>
  );
}
