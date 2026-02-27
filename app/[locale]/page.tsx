import Image from 'next/image';
import Link from 'next/link';
import FadeInOnScroll from '@/app/components/FadeInOnScroll';
import StatsSection from '@/app/components/StatsSection';
import { getTranslation } from '@/app/lib/i18n';
import { events } from '@/app/lib/data';
import { getStatusColor, formatDate } from '@/app/lib/utils';
import { getAuctions } from '@/db/queries';
import { mapDBAuctionToFrontend } from '@/lib/mappers';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getTranslation(locale);

  const dbAuctions = await getAuctions(0);
  const allAuctions = dbAuctions.map((row) =>
    mapDBAuctionToFrontend(row, {
      lotCount: row.lotCount,
      coverImageUrl: row.coverImageUrl ?? undefined,
    }),
  );

  const featuredAuctions = allAuctions.slice(0, 3);
  const upcomingEvents = events.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-5 md:min-h-[80vh] md:px-8">
        <Image
          src="/omena/images/hero/hero-bg.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-brown/70 via-dark-brown/50 to-dark-brown/70" />
        <div className="relative z-10 text-center">
          <h1 className="font-serif text-5xl font-bold text-gold md:text-7xl lg:text-8xl drop-shadow-lg">
            Omena
          </h1>
          <div className="mx-auto my-6 h-px w-16 bg-gold" />
          <p className="font-serif text-lg text-white/90 md:text-2xl">
            {t.heroSubtitle}
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70 md:max-w-lg md:text-base">
            {t.heroDescription}
          </p>
          <Link
            href={`/${locale}/auctions`}
            className="mt-8 inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-gold-dark hover:scale-[1.02]"
          >
            {t.heroCTA}
          </Link>
        </div>
      </section>

      <FadeInOnScroll>
        <StatsSection />
      </FadeInOnScroll>

      {/* Featured Auctions */}
      <FadeInOnScroll>
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <h2 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">
              {t.featuredAuctions}
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
              {featuredAuctions.map((auction) => (
                <Link
                  key={auction.id}
                  href={`/${locale}/auctions/${auction.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-beige shadow-sm group-hover:shadow-md">
                    <Image
                      src={auction.coverImage}
                      alt={auction.title}
                      width={800}
                      height={600}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(auction.status)}`}
                      >
                        {auction.status === 'upcoming'
                          ? t.statusUpcoming
                          : auction.status === 'live'
                            ? t.statusLive
                            : t.statusEnded}
                      </span>
                      <span className="text-xs text-taupe">
                        {auction.totalLots} {t.objects}
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
                href={`/${locale}/auctions`}
                className="inline-flex items-center gap-2 text-sm font-medium text-gold underline-offset-4 decoration-gold/0 hover:decoration-gold transition-all duration-200 hover:text-gold-dark"
              >
                {t.viewAllAuctions}
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
              {t.upcomingEvents}
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-xl bg-white shadow-sm transition-shadow duration-300 hover:shadow-md"
                >
                  <div className="relative h-48 overflow-hidden bg-beige">
                    <Image
                      src={event.image}
                      alt={event.title}
                      width={800}
                      height={500}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-medium text-white">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  <div className="p-6">
                    <span className="rounded bg-beige px-2 py-1 text-xs text-taupe">
                      {event.type === 'auction'
                        ? t.eventTypeAuction
                        : event.type === 'exhibition'
                          ? t.eventTypeExhibition
                          : t.eventTypeGala}
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
              {t.ctaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/80">
              {t.ctaDescription}
            </p>
            <Link
              href={`/${locale}/contact`}
              className="mt-8 inline-block rounded-full border-2 border-white px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-white hover:text-gold hover:scale-[1.02]"
            >
              {t.ctaButton}
            </Link>
          </div>
        </section>
      </FadeInOnScroll>
    </>
  );
}
