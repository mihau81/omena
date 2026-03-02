'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/utils';
import { useLocale } from '@/app/lib/LocaleContext';
import { useCurrency } from '@/app/lib/CurrencyContext';

interface Favorite {
  lotId: string;
  lotTitle: string;
  lotArtist: string;
  lotNumber: number;
  lotStatus: string;
  estimateMin: number;
  estimateMax: number;
  hammerPrice: number | null;
  auctionTitle: string;
  auctionSlug: string;
  imageUrl: string | null;
  addedAt: string;
}

export default function AccountFavoritesPage() {
  const { locale } = useLocale();
  const { formatPrice } = useCurrency();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/me/favorites'))
      .then((res) => (res.ok ? res.json() : { favorites: [] }))
      .then((data) => setFavorites(data.favorites ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function removeFavorite(lotId: string) {
    setFavorites((prev) => prev.filter((f) => f.lotId !== lotId));
    await fetch(apiUrl('/api/me/favorites'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lotId }),
    });
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">Favorites</h1>
      <p className="mt-2 text-sm text-taupe">Lots you&apos;re watching.</p>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-taupe">No favorites yet.</p>
          <Link href={`/${locale}/auctions`} className="mt-3 inline-block text-sm text-gold hover:underline">
            Browse auctions
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <div key={fav.lotId} className="group relative rounded-xl border border-beige bg-white overflow-hidden">
              <Link href={`/${locale}/auctions/${fav.auctionSlug}/${fav.lotId}`}>
                <div className="aspect-square bg-beige">
                  {fav.imageUrl ? (
                    <Image
                      src={fav.imageUrl}
                      alt={fav.lotTitle}
                      width={400}
                      height={400}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-taupe">
                      Lot #{fav.lotNumber}
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <Link
                  href={`/${locale}/auctions/${fav.auctionSlug}/${fav.lotId}`}
                  className="font-serif text-sm font-bold text-dark-brown hover:text-gold line-clamp-1"
                >
                  {fav.lotTitle}
                </Link>
                <p className="mt-0.5 text-xs text-taupe">{fav.lotArtist}</p>
                <p className="mt-2 text-xs text-taupe">
                  Est. {formatPrice(fav.estimateMin)} – {formatPrice(fav.estimateMax)}
                </p>
                {fav.hammerPrice && (
                  <p className="mt-1 text-sm font-medium text-dark-brown">
                    Sold: {formatPrice(fav.hammerPrice)}
                  </p>
                )}
                <button
                  onClick={() => removeFavorite(fav.lotId)}
                  className="mt-3 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
