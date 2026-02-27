import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center px-5 md:min-h-[80vh] md:px-8">
      {/* Background image */}
      <Image
        src="/omena/images/hero/hero-bg.jpg"
        alt=""
        fill
        className="object-cover"
        priority
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-brown/70 via-dark-brown/50 to-dark-brown/70" />

      <div className="relative z-10 text-center">
        <h1 className="font-serif text-5xl font-bold text-gold md:text-7xl lg:text-8xl drop-shadow-lg">
          Omena
        </h1>

        <div className="mx-auto my-6 h-px w-16 bg-gold" />

        <p className="font-serif text-lg text-white/90 md:text-2xl">
          Dom Aukcyjny Dzieł Sztuki
        </p>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70 md:max-w-lg md:text-base">
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
