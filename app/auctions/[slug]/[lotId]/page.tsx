import { Metadata } from "next";
import Link from "next/link";
import { auctions, lots } from "../../../lib/data";
import {
  getLotById,
  getAuctionBySlug,
  getLotsByAuction,
} from "../../../lib/utils";
import LotDetail from "../../../components/LotDetail";
import Breadcrumbs from "../../../components/Breadcrumbs";

export function generateStaticParams() {
  return lots.map((lot) => ({
    slug: lot.auctionSlug,
    lotId: lot.id,
  }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lotId: string }>;
}): Promise<Metadata> {
  return params.then(({ slug, lotId }) => {
    const lot = getLotById(slug, lotId);
    if (!lot) return { title: "Lot" };
    return {
      title: `${lot.title} \u2014 ${lot.artist}`,
    };
  });
}

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ slug: string; lotId: string }>;
}) {
  const { slug, lotId } = await params;
  const auction = getAuctionBySlug(slug);
  const lot = getLotById(slug, lotId);

  if (!lot || !auction) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-16 text-center md:px-8">
        <h1 className="font-serif text-3xl font-bold text-dark-brown">
          Nie znaleziono obiektu
        </h1>
        <Link href="/auctions" className="mt-4 inline-block text-gold">
          Powr&oacute;t do listy aukcji
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: "Strona g\u0142\u00f3wna", href: "/" },
          { label: "Aukcje", href: "/auctions" },
          { label: auction.title, href: `/auctions/${auction.slug}` },
          { label: `Lot ${lot.lotNumber}` },
        ]}
      />

      <div className="mt-6">
        <LotDetail lot={lot} />
      </div>

      <div className="mt-12">
        <Link
          href={`/auctions/${auction.slug}`}
          className="text-gold transition-colors hover:text-gold-dark"
        >
          &larr; Powr&oacute;t do aukcji
        </Link>
      </div>
    </section>
  );
}
