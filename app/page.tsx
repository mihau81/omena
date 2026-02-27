import Link from "next/link";
import HeroSection from "./components/HeroSection";
import StatsSection from "./components/StatsSection";
import FadeInOnScroll from "./components/FadeInOnScroll";
import { auctions, events } from "./lib/data";
import { getStatusLabel, getStatusColor, formatDate } from "./lib/utils";

export default function HomePage() {
  const featuredAuctions = auctions.slice(0, 3);
  const upcomingEvents = events.slice(0, 3);

  return (
    <>
      <HeroSection />
      <FadeInOnScroll>
        <StatsSection />
      </FadeInOnScroll>

      {/* Featured Auctions */}
      <FadeInOnScroll>
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <h2 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">
              Wyróżnione aukcje
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
              {featuredAuctions.map((auction) => (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.slug}`}
                  className="group block"
                >
                  <div className="aspect-[4/3] rounded-lg bg-beige transition-all duration-300 group-hover:scale-[1.02] shadow-sm group-hover:shadow-md" role="img" aria-label={auction.title} />
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(auction.status)}`}
                      >
                        {getStatusLabel(auction.status)}
                      </span>
                      <span className="text-xs text-taupe">
                        {auction.totalLots} obiektów
                      </span>
                    </div>
                    <h3 className="mt-2 font-serif text-lg font-bold text-dark-brown group-hover:text-gold">
                      {auction.title}
                    </h3>
                    <p className="mt-1 text-sm text-taupe">
                      {formatDate(auction.date)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/auctions"
                className="inline-flex items-center gap-2 text-sm font-medium text-gold underline-offset-4 decoration-gold/0 hover:decoration-gold transition-all duration-200 hover:text-gold-dark"
              >
                Zobacz wszystkie aukcje
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </FadeInOnScroll>

      {/* Upcoming Events */}
      <FadeInOnScroll>
        <section className="bg-beige/50 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <h2 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">
              Nadchodzące wydarzenia
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-xl bg-white shadow-sm transition-shadow duration-300 hover:shadow-md"
                >
                  <div className="relative h-48 bg-beige" role="img" aria-label={event.title}>
                    <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-medium text-white">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  <div className="p-6">
                    <span className="rounded bg-beige px-2 py-1 text-xs text-taupe">
                      {event.type === "auction"
                        ? "Aukcja"
                        : event.type === "exhibition"
                          ? "Wystawa"
                          : "Gala"}
                    </span>
                    <h3 className="mt-3 font-serif text-xl font-bold text-dark-brown">
                      {event.title}
                    </h3>
                    <p className="mt-1 text-sm text-taupe">{event.location}</p>
                    <p className="mt-2 text-sm leading-relaxed text-taupe">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInOnScroll>

      {/* CTA */}
      <FadeInOnScroll>
        <section className="bg-gold py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 text-center md:px-8">
            <h2 className="font-serif text-3xl font-bold text-white md:text-4xl">
              Zainteresowany współpracą?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/80">
              Skontaktuj się z nami, aby omówić konsygnację dzieł, wycenę
              kolekcji lub możliwości partnerstwa.
            </p>
            <Link
              href="/contact"
              className="mt-8 inline-block rounded-full border-2 border-white px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-white hover:text-gold hover:scale-[1.02]"
            >
              Skontaktuj się z nami
            </Link>
          </div>
        </section>
      </FadeInOnScroll>
    </>
  );
}
