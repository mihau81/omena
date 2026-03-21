import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  apiUrl,
  isYouTubeUrl,
  getYouTubeVideoId,
  getYouTubeThumbnail,
  formatPrice,
  formatDate,
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
  formatPriceShort,
  formatTimestamp,
  slugifyArtist,
} from '@/app/lib/utils';

// ─── apiUrl ───────────────────────────────────────────────────────────────────

describe('apiUrl', () => {
  it('prepends /omenaa base path to a given path', () => {
    expect(apiUrl('/api/lots')).toBe('/omenaa/api/lots');
  });

  it('prepends base path to root path', () => {
    expect(apiUrl('/')).toBe('/omenaa/');
  });

  it('prepends base path to nested path', () => {
    expect(apiUrl('/api/auctions/123/lots')).toBe('/omenaa/api/auctions/123/lots');
  });

  it('prepends base path to empty string', () => {
    expect(apiUrl('')).toBe('/omenaa');
  });

  it('handles path with query string', () => {
    expect(apiUrl('/api/search?q=painting')).toBe('/omenaa/api/search?q=painting');
  });

  it('handles path with hash fragment', () => {
    expect(apiUrl('/page#section')).toBe('/omenaa/page#section');
  });
});

// ─── isYouTubeUrl ─────────────────────────────────────────────────────────────

describe('isYouTubeUrl', () => {
  it('returns true for youtube.com/watch?v= URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('returns true for youtube.com/embed/ URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
  });

  it('returns true for youtube.com/shorts/ URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
  });

  it('returns true for youtu.be short URL', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('returns false for non-YouTube URL', () => {
    expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isYouTubeUrl('')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isYouTubeUrl('not-a-url')).toBe(false);
  });

  it('returns false for a URL that contains youtube but is not a video URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/channel/UCxxx')).toBe(false);
  });
});

// ─── getYouTubeVideoId ────────────────────────────────────────────────────────

describe('getYouTubeVideoId', () => {
  it('extracts video ID from watch?v= URL', () => {
    expect(getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from embed URL', () => {
    expect(getYouTubeVideoId('https://www.youtube.com/embed/abc1234ABCD')).toBe('abc1234ABCD');
  });

  it('extracts video ID from shorts URL', () => {
    expect(getYouTubeVideoId('https://www.youtube.com/shorts/xyz1234XYZ1')).toBe('xyz1234XYZ1');
  });

  it('extracts video ID from youtu.be URL', () => {
    expect(getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URL', () => {
    expect(getYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getYouTubeVideoId('')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(getYouTubeVideoId('just some text')).toBeNull();
  });

  it('extracts exactly 11 characters for video ID', () => {
    const id = getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ');
    expect(id).toHaveLength(11);
  });
});

// ─── getYouTubeThumbnail ─────────────────────────────────────────────────────

describe('getYouTubeThumbnail', () => {
  it('returns correct thumbnail URL for a video ID', () => {
    expect(getYouTubeThumbnail('dQw4w9WgXcQ')).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    );
  });

  it('uses mqdefault quality', () => {
    const url = getYouTubeThumbnail('abc123');
    expect(url).toContain('mqdefault.jpg');
  });

  it('includes the video ID in the URL', () => {
    const id = 'testVideoId1';
    const url = getYouTubeThumbnail(id);
    expect(url).toContain(id);
  });

  it('constructs URL with img.youtube.com domain', () => {
    const url = getYouTubeThumbnail('anyId12345a');
    expect(url).toMatch(/^https:\/\/img\.youtube\.com\/vi\//);
  });
});

// ─── formatPrice ─────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('formats a simple integer price', () => {
    expect(formatPrice(1000)).toBe('1 000 PLN');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0 PLN');
  });

  it('formats a price below 1000 without separator', () => {
    expect(formatPrice(500)).toBe('500 PLN');
  });

  it('formats a price above 1000 with a space separator', () => {
    expect(formatPrice(1500)).toBe('1 500 PLN');
  });

  it('formats a price above 1000000', () => {
    expect(formatPrice(1000000)).toBe('1 000 000 PLN');
  });

  it('formats 999 without separator', () => {
    expect(formatPrice(999)).toBe('999 PLN');
  });

  it('formats 1001 with separator', () => {
    expect(formatPrice(1001)).toBe('1 001 PLN');
  });

  it('formats 50000 correctly', () => {
    expect(formatPrice(50000)).toBe('50 000 PLN');
  });

  it('formats 123456789 correctly', () => {
    expect(formatPrice(123456789)).toBe('123 456 789 PLN');
  });

  it('ends with PLN suffix', () => {
    expect(formatPrice(999)).toMatch(/ PLN$/);
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a January date in Polish', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('stycznia');
    expect(result).toContain('2024');
  });

  it('formats a December date in Polish', () => {
    const result = formatDate('2024-12-25');
    expect(result).toContain('grudnia');
    expect(result).toContain('2024');
  });

  it('formats a March date in Polish', () => {
    const result = formatDate('2024-03-01');
    expect(result).toContain('marca');
  });

  it('formats all months correctly', () => {
    const months = [
      'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
      'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
    ];
    months.forEach((month, idx) => {
      const dateStr = `2024-${String(idx + 1).padStart(2, '0')}-01`;
      expect(formatDate(dateStr)).toContain(month);
    });
  });

  it('includes the year in the output', () => {
    expect(formatDate('2023-06-15')).toContain('2023');
  });

  it('returns a string with day, month name, and year', () => {
    const result = formatDate('2024-07-04');
    // Should contain a number (day), month name, and year
    expect(result).toMatch(/\d+ \w+ \d{4}/);
  });
});

// ─── getStatusLabel ───────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it('returns "Nadchodząca" for upcoming status', () => {
    expect(getStatusLabel('upcoming')).toBe('Nadchodząca');
  });

  it('returns "Trwająca" for live status', () => {
    expect(getStatusLabel('live')).toBe('Trwająca');
  });

  it('returns "Zakończona" for ended status', () => {
    expect(getStatusLabel('ended')).toBe('Zakończona');
  });
});

// ─── getStatusColor ───────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns blue classes for upcoming status', () => {
    expect(getStatusColor('upcoming')).toBe('bg-blue-100 text-blue-800');
  });

  it('returns green classes for live status', () => {
    expect(getStatusColor('live')).toBe('bg-green-100 text-green-800');
  });

  it('returns gray classes for ended status', () => {
    expect(getStatusColor('ended')).toBe('bg-gray-100 text-gray-800');
  });

  it('returns strings containing both bg and text classes', () => {
    const color = getStatusColor('live');
    expect(color).toContain('bg-');
    expect(color).toContain('text-');
  });
});

// ─── getCategoryLabel ─────────────────────────────────────────────────────────

describe('getCategoryLabel', () => {
  it('returns "Malarstwo" for malarstwo category', () => {
    expect(getCategoryLabel('malarstwo')).toBe('Malarstwo');
  });

  it('returns "Rzeźba" for rzezba category', () => {
    expect(getCategoryLabel('rzezba')).toBe('Rzeźba');
  });

  it('returns "Fotografia" for fotografia category', () => {
    expect(getCategoryLabel('fotografia')).toBe('Fotografia');
  });

  it('returns "Kolekcja mieszana" for mixed category', () => {
    expect(getCategoryLabel('mixed')).toBe('Kolekcja mieszana');
  });
});

// ─── formatPriceShort ─────────────────────────────────────────────────────────

describe('formatPriceShort', () => {
  it('formats numbers below 1000 as plain PLN', () => {
    expect(formatPriceShort(500)).toBe('500 PLN');
  });

  it('formats zero as plain PLN', () => {
    expect(formatPriceShort(0)).toBe('0 PLN');
  });

  it('formats 999 without abbreviation', () => {
    expect(formatPriceShort(999)).toBe('999 PLN');
  });

  it('formats exactly 1000 as "1 tys. PLN"', () => {
    expect(formatPriceShort(1000)).toBe('1 tys. PLN');
  });

  it('formats 1500 as "2 tys. PLN" (rounded)', () => {
    expect(formatPriceShort(1500)).toBe('2 tys. PLN');
  });

  it('formats 1499 as "1 tys. PLN" (rounded down)', () => {
    expect(formatPriceShort(1499)).toBe('1 tys. PLN');
  });

  it('formats 50000 as "50 tys. PLN"', () => {
    expect(formatPriceShort(50000)).toBe('50 tys. PLN');
  });

  it('formats 999999 as "1000 tys. PLN"', () => {
    expect(formatPriceShort(999999)).toBe('1000 tys. PLN');
  });

  it('formats exactly 1000000 as "1 mln PLN"', () => {
    expect(formatPriceShort(1000000)).toBe('1 mln PLN');
  });

  it('formats 1500000 as "1.5 mln PLN"', () => {
    expect(formatPriceShort(1500000)).toBe('1.5 mln PLN');
  });

  it('formats 2000000 as "2 mln PLN" (no trailing .0)', () => {
    expect(formatPriceShort(2000000)).toBe('2 mln PLN');
  });

  it('formats 10000000 as "10 mln PLN"', () => {
    expect(formatPriceShort(10000000)).toBe('10 mln PLN');
  });

  it('formats 1100000 as "1.1 mln PLN"', () => {
    expect(formatPriceShort(1100000)).toBe('1.1 mln PLN');
  });

  it('handles large numbers in millions', () => {
    expect(formatPriceShort(5000000)).toBe('5 mln PLN');
  });
});

// ─── formatTimestamp ──────────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a Date object and returns formatted time', () => {
    const date = new Date('2024-06-15T14:30:45');
    const result = formatTimestamp(date);
    // Should contain time parts HH:MM:SS format
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('accepts an ISO date string and returns formatted time', () => {
    const result = formatTimestamp('2024-06-15T14:30:45');
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('accepts a numeric timestamp (milliseconds) and returns formatted time', () => {
    const ts = new Date('2024-06-15T14:30:45').getTime();
    const result = formatTimestamp(ts);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('returns the same result for Date object and equivalent numeric timestamp', () => {
    const date = new Date('2024-06-15T10:20:30');
    const ts = date.getTime();
    expect(formatTimestamp(date)).toBe(formatTimestamp(ts));
  });

  it('returns the same result for Date object and equivalent ISO string', () => {
    const date = new Date('2024-06-15T10:20:30.000Z');
    const iso = date.toISOString();
    expect(formatTimestamp(date)).toBe(formatTimestamp(iso));
  });

  it('formats time in HH:MM:SS format', () => {
    // Use a locale-fixed time for comparison — result depends on toLocaleTimeString
    const date = new Date('2024-01-01T08:05:03');
    const result = formatTimestamp(date);
    // The result should include hour, minute, second components separated by colons
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
  });
});

// ─── slugifyArtist ────────────────────────────────────────────────────────────

describe('slugifyArtist', () => {
  it('converts name to lowercase', () => {
    expect(slugifyArtist('Pablo Picasso')).toBe('pablo-picasso');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugifyArtist('Jan Matejko')).toBe('jan-matejko');
  });

  it('removes Polish diacritics (NFD-decomposable chars like ó, ń, ś)', () => {
    // Note: Ł/ł is a stroke character (not a combining mark), so it becomes empty
    // ł → stripped by [^a-z0-9]+ → becomes separator or dropped
    expect(slugifyArtist('Józef Moński')).toBe('jozef-monski');
  });

  it('removes accented characters (ó, ś, ź, ż) via NFD normalization', () => {
    // Ł is a standalone Unicode stroke character — NFD does not decompose it,
    // so it gets stripped entirely by the [^a-z0-9]+ replacement
    expect(slugifyArtist('Różański')).toBe('rozanski');
  });

  it('handles French diacritics', () => {
    expect(slugifyArtist('Édouard Manet')).toBe('edouard-manet');
  });

  it('replaces multiple spaces with a single hyphen', () => {
    expect(slugifyArtist('Jan  Matejko')).toBe('jan-matejko');
  });

  it('removes leading hyphens', () => {
    expect(slugifyArtist(' Jan Matejko')).toBe('jan-matejko');
  });

  it('removes trailing hyphens', () => {
    expect(slugifyArtist('Jan Matejko ')).toBe('jan-matejko');
  });

  it('handles empty string', () => {
    expect(slugifyArtist('')).toBe('');
  });

  it('handles name with special characters', () => {
    expect(slugifyArtist('O\'Keeffe')).toBe('o-keeffe');
  });

  it('handles name with numbers', () => {
    expect(slugifyArtist('Artist 2024')).toBe('artist-2024');
  });

  it('converts all uppercase to lowercase slug', () => {
    expect(slugifyArtist('PABLO PICASSO')).toBe('pablo-picasso');
  });

  it('handles single-word name', () => {
    expect(slugifyArtist('Banksy')).toBe('banksy');
  });

  it('handles name with dots', () => {
    expect(slugifyArtist('J.M.W. Turner')).toBe('j-m-w-turner');
  });

  it('handles ó correctly (Polish letter, NFD-decomposable)', () => {
    expect(slugifyArtist('Piotr Józef')).toBe('piotr-jozef');
  });

  it('handles ś correctly (NFD-decomposable Polish letter)', () => {
    // Ś decomposes via NFD; ą, ę remain as stroke/special chars and are stripped
    expect(slugifyArtist('Śląski Artysta')).toBe('slaski-artysta');
  });

  it('handles name with parentheses', () => {
    expect(slugifyArtist('Artist (Unknown)')).toBe('artist-unknown');
  });

  it('produces URL-safe slug (no special chars)', () => {
    // Any output must only contain lowercase letters, digits, and hyphens
    const slug = slugifyArtist('Jan Matejko');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});
