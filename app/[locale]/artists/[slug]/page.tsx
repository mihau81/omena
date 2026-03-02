import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslation } from '@/app/lib/i18n';
import { getArtistWithLots } from '@/db/queries/artists';
import Breadcrumbs from '@/app/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
  });
}

export default async function ArtistDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const t = getTranslation(locale);

  const data = await getArtistWithLots(slug);
  if (!data) notFound();

  const { artist, stats, soldLots, availableLots } = data;

  const years =
    artist.birthYear && artist.deathYear
      ? `${artist.birthYear}–${artist.deathYear}`
      : artist.birthYear
      ? `b. ${artist.birthYear}`
      : artist.deathYear
      ? `d. ${artist.deathYear}`
      : null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.artistsTitle, href: `/${locale}/artists` },
          { label: artist.name },
        ]}
      />

      {/* Artist header */}
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        {/* Photo */}
        {artist.imageUrl && (
          <div className="shrink-0">
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="h-32 w-32 rounded-xl object-cover border border-beige shadow-sm md:h-40 md:w-40"
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h1 className="font-serif text-4xl font-bold text-dark-brown md:text-5xl">
            {artist.name}
          </h1>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-taupe">
            {artist.nationality && (
              <span>
                <span className="font-medium text-dark-brown">{t.artistNationality}:</span>{' '}
                {artist.nationality}
              </span>
            )}
            {years && (
              <span>
                <span className="font-medium text-dark-brown">{t.artistYears}:</span>{' '}
                {years}
              </span>
            )}
          </div>

          {/* Stats pills */}
          {stats.totalSold > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-lg bg-beige px-4 py-2 text-center">
                <p className="text-xs text-taupe">{t.artistTotalSold}</p>
                <p className="text-lg font-bold text-dark-brown">{stats.totalSold}</p>
              </div>
              {stats.avgHammer && (
                <div className="rounded-lg bg-beige px-4 py-2 text-center">
                  <p className="text-xs text-taupe">{t.artistAvgHammer}</p>
                  <p className="text-lg font-bold text-dark-brown">{formatPLN(stats.avgHammer)}</p>
                </div>
              )}
              {stats.maxHammer && (
                <div className="rounded-lg bg-beige px-4 py-2 text-center">
                  <p className="text-xs text-taupe">{t.artistHighestHammer}</p>
                  <p className="text-lg font-bold text-dark-brown">{formatPLN(stats.maxHammer)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {artist.bio && (
        <div className="mt-10">
          <h2 className="font-serif text-2xl font-bold text-dark-brown">{t.artistBio}</h2>
          <div className="mt-3 max-w-3xl">
            <p className="text-base leading-relaxed text-taupe whitespace-pre-wrap">{artist.bio}</p>
          </div>
        </div>
      )}

      {/* Available lots */}
      {availableLots.length > 0 && (
        <div className="mt-12">
          <h2 className="font-serif text-2xl font-bold text-dark-brown">{t.artistAvailableLots}</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {availableLots.map((lot) => (
              <Link
                key={lot.id}
                href={`/${locale}/auctions/${lot.auctionSlug}/${lot.lotNumber}`}
                className="group overflow-hidden rounded-xl border border-beige bg-white transition-all hover:border-gold/40 hover:shadow-md"
              >
                {/* Image */}
                <div className="aspect-square overflow-hidden bg-cream">
                  {lot.primaryImageUrl ? (
                    <img
                      src={lot.primaryThumbnailUrl ?? lot.primaryImageUrl}
                      alt={lot.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-beige-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-xs text-taupe">
                    {t.lot} {lot.lotNumber}
                  </p>
                  <p className="mt-0.5 font-medium text-dark-brown text-sm leading-tight line-clamp-2">
                    {lot.title}
                  </p>
                  <p className="mt-1 text-xs text-taupe">{lot.auctionTitle}</p>
                  <p className="mt-1 text-sm font-medium text-dark-brown">
                    {t.estimate}: {formatPLN(lot.estimateMin)}–{formatPLN(lot.estimateMax)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Auction results */}
      <div className="mt-12">
        <h2 className="font-serif text-2xl font-bold text-dark-brown">{t.artistAuctionResults}</h2>

        {soldLots.length === 0 ? (
          <p className="mt-4 text-taupe">{t.artistNoResults}</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-beige bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-beige bg-cream/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Auction</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Lot</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Title</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">{t.hammerPrice}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige/50">
                  {soldLots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-cream/30 transition-colors">
                      <td className="px-4 py-3 text-taupe text-xs whitespace-nowrap">
                        <Link
                          href={`/${locale}/auctions/${lot.auctionSlug}`}
                          className="hover:text-gold transition-colors"
                        >
                          {lot.auctionTitle}
                          {lot.auctionEndDate && (
                            <span className="ml-1 text-taupe/60">
                              ({formatDate(lot.auctionEndDate)})
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-taupe whitespace-nowrap">
                        <Link
                          href={`/${locale}/auctions/${lot.auctionSlug}/${lot.lotNumber}`}
                          className="hover:text-gold transition-colors"
                        >
                          {t.lot} {lot.lotNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-dark-brown max-w-xs">
                        <Link
                          href={`/${locale}/auctions/${lot.auctionSlug}/${lot.lotNumber}`}
                          className="hover:text-gold transition-colors line-clamp-1"
                        >
                          {lot.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-dark-brown whitespace-nowrap">
                        {lot.hammerPrice ? formatPLN(lot.hammerPrice) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
