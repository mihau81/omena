'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Dictionary } from '@/app/lib/i18n';
import Breadcrumbs from '@/app/components/Breadcrumbs';

interface ArtistRow {
  id: string;
  slug: string;
  name: string;
  nationality: string | null;
  birthYear: number | null;
  deathYear: number | null;
  lotCount: number;
  imageUrl: string | null;
}

interface Props {
  artists: ArtistRow[];
  t: Dictionary;
  locale: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function formatYears(birth: number | null, death: number | null): string {
  if (!birth && !death) return '';
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  return `d. ${death}`;
}

export default function ArtistsClient({ artists, t, locale }: Props) {
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = artists;

    if (search.length >= 2) {
      const q = normalize(search);
      result = result.filter((a) => normalize(a.name).includes(q));
      return result;
    }

    if (activeLetter) {
      result = result.filter((a) => normalize(a.name).startsWith(activeLetter));
    }

    return result;
  }, [artists, search, activeLetter]);

  // Which letters have artists
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const a of artists) {
      const first = normalize(a.name)[0];
      if (first) set.add(first);
    }
    return set;
  }, [artists]);

  const handleLetterClick = (letter: string) => {
    setActiveLetter(activeLetter === letter ? null : letter);
    setSearch('');
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.artistsTitle },
        ]}
      />

      <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown md:text-5xl">
        {t.artistsTitle}
      </h1>

      {/* Search */}
      <div className="mt-6">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveLetter(null); }}
          placeholder={t.artistsSearch}
          className="w-full max-w-sm px-4 py-2.5 text-sm border border-beige-dark rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none bg-white"
        />
      </div>

      {/* A–Z navigation */}
      {!search && (
        <div className="-mx-5 mt-6 flex flex-wrap gap-1 px-5">
          <button
            onClick={() => { setActiveLetter(null); setSearch(''); }}
            className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
              activeLetter === null
                ? 'bg-gold text-white'
                : 'text-taupe hover:text-dark-brown hover:bg-beige/60'
            }`}
          >
            {t.artistsAll}
          </button>
          {ALPHABET.map((letter) => {
            const has = availableLetters.has(letter);
            return (
              <button
                key={letter}
                onClick={() => has && handleLetterClick(letter)}
                disabled={!has}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  activeLetter === letter
                    ? 'bg-gold text-white'
                    : has
                    ? 'text-taupe hover:text-dark-brown hover:bg-beige/60'
                    : 'text-beige-dark cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* Results count */}
      <p className="mt-4 text-sm text-taupe">
        {filtered.length} {t.artistLots}
      </p>

      {/* Artist grid */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((artist) => (
            <Link
              key={artist.id}
              href={`/${locale}/artists/${artist.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-beige bg-white p-4 transition-all hover:border-gold/40 hover:shadow-sm"
            >
              {/* Avatar / image */}
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover border border-beige"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-beige text-dark-brown font-serif text-lg font-bold">
                  {normalize(artist.name)[0] ?? '?'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="font-medium text-dark-brown truncate group-hover:text-gold transition-colors">
                  {artist.name}
                </p>
                <p className="text-xs text-taupe truncate mt-0.5">
                  {[artist.nationality, formatYears(artist.birthYear, artist.deathYear)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {artist.lotCount > 0 && (
                  <p className="text-xs text-taupe mt-0.5">
                    {artist.lotCount} {t.artistLots}
                  </p>
                )}
              </div>

              <svg className="w-4 h-4 shrink-0 text-taupe group-hover:text-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-12 text-center text-taupe">{t.artistsNotFound}</p>
      )}
    </section>
  );
}
