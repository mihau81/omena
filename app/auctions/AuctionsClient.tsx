"use client";

import { useState } from "react";
import { auctions } from "../lib/data";
import type { Auction } from "../lib/types";
import { getCategoryLabel, getStatusLabel } from "../lib/utils";
import AuctionCard from "../components/AuctionCard";
import FilterBar from "../components/FilterBar";
import Breadcrumbs from "../components/Breadcrumbs";

const categoryFilters = [
  "Wszystkie",
  ...Array.from(
    new Set(auctions.map((a) => getCategoryLabel(a.category)))
  ),
];

const statusFilters = [
  "Wszystkie",
  ...Array.from(
    new Set(auctions.map((a) => getStatusLabel(a.status)))
  ),
];

export default function AuctionsClient() {
  const [activeCategory, setActiveCategory] = useState("Wszystkie");
  const [activeStatus, setActiveStatus] = useState("Wszystkie");

  const filtered = auctions.filter((a: Auction) => {
    const matchCategory =
      activeCategory === "Wszystkie" ||
      getCategoryLabel(a.category) === activeCategory;
    const matchStatus =
      activeStatus === "Wszystkie" ||
      getStatusLabel(a.status) === activeStatus;
    return matchCategory && matchStatus;
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: "Strona g\u0142\u00f3wna", href: "/" },
          { label: "Aukcje" },
        ]}
      />

      <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown md:text-5xl">
        Aukcje
      </h1>

      <div className="mt-8">
        <FilterBar
          categories={categoryFilters}
          statuses={statusFilters}
          activeCategory={activeCategory}
          activeStatus={activeStatus}
          onCategoryChange={setActiveCategory}
          onStatusChange={setActiveStatus}
        />
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-center text-taupe">
          Brak aukcji spe\u0142niaj\u0105cych wybrane kryteria.
        </p>
      )}
    </section>
  );
}
