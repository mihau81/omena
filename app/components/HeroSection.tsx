import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream to-beige px-5 md:min-h-[80vh] md:px-8">
      <div className="text-center">
        <h1 className="font-serif text-5xl font-bold text-gold md:text-7xl lg:text-8xl">
          Omena
        </h1>

        <div className="mx-auto my-6 h-px w-16 bg-gold" />

        <p className="font-serif text-lg text-taupe md:text-2xl">
          Dom Aukcyjny Dzieł Sztuki
        </p>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-taupe md:max-w-lg md:text-base">
          Łączymy kolekcjonerów z wyjątkowymi dziełami najwybitniejszych
          artystów. Odkryj sztukę, która inspiruje od pokoleń.
        </p>

        <Link
          href="/auctions"
          className="mt-8 inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-gold-dark hover:scale-[1.02]"
        >
          Przeglądaj aukcje
        </Link>
      </div>
    </section>
  );
}
