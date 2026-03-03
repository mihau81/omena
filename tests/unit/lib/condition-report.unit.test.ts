import { describe, it, expect } from 'vitest';
import {
  generateConditionReportHTML,
  generateBatchConditionReportHTML,
  type ConditionReportLot,
  type ConditionReportAuction,
  type ConditionReportMedia,
  type BatchConditionReportItem,
} from '@/lib/condition-report';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeLot(overrides: Partial<ConditionReportLot> = {}): ConditionReportLot {
  return {
    id: 'lot-001',
    lotNumber: 1,
    title: 'Pejzaz nadmorski',
    artist: 'Jan Matejko',
    medium: 'Olej na plotnie',
    dimensions: '80 x 120 cm',
    year: 1880,
    estimateMin: 50000,
    estimateMax: 80000,
    conditionNotes: 'Drobne przetarcia w naroznikach, werniksowana.',
    provenance: ['Kolekcja prywatna, Krakow', 'Galeria Sztuki, Warszawa'],
    description: 'Obraz przedstawiajacy krajobraz nadmorski.',
    ...overrides,
  };
}

function makeAuction(overrides: Partial<ConditionReportAuction> = {}): ConditionReportAuction {
  return {
    id: 'auction-001',
    title: 'Aukcja Sztuki Polskiej',
    startDate: new Date('2026-04-10T18:00:00Z'),
    ...overrides,
  };
}

function makeMedia(overrides: Partial<ConditionReportMedia> = {}): ConditionReportMedia {
  return {
    url: 'https://cdn.omena.pl/lot-001.jpg',
    largeUrl: 'https://cdn.omena.pl/lot-001-large.jpg',
    mediumUrl: 'https://cdn.omena.pl/lot-001-medium.jpg',
    altText: 'Pejzaz nadmorski',
    ...overrides,
  };
}

// ─── generateConditionReportHTML ─────────────────────────────────────────────

describe('generateConditionReportHTML', () => {
  describe('with full data', () => {
    const html = generateConditionReportHTML(makeLot(), makeAuction(), makeMedia());

    it('returns valid HTML document', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="pl">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('contains OMENA branding', () => {
      expect(html).toContain('OMENA');
      expect(html).toContain('Dom Aukcyjny');
    });

    it('contains report title with lot number', () => {
      expect(html).toContain('Raport Stanu');
      expect(html).toContain('Lot 1');
    });

    it('contains auction info', () => {
      expect(html).toContain('Aukcja Sztuki Polskiej');
      expect(html).toContain('Aukcja');
    });

    it('contains lot title', () => {
      expect(html).toContain('Pejzaz nadmorski');
    });

    it('contains artist name', () => {
      expect(html).toContain('Jan Matejko');
    });

    it('contains medium/technique', () => {
      expect(html).toContain('Olej na plotnie');
    });

    it('contains dimensions', () => {
      expect(html).toContain('80 x 120 cm');
    });

    it('contains year', () => {
      expect(html).toContain('1880');
    });

    it('contains condition notes section', () => {
      expect(html).toContain('Stan zachowania');
      expect(html).toContain('Drobne przetarcia w naroznikach, werniksowana.');
    });

    it('contains provenance entries', () => {
      expect(html).toContain('Proweniencja');
      expect(html).toContain('Kolekcja prywatna, Krakow');
      expect(html).toContain('Galeria Sztuki, Warszawa');
    });

    it('contains estimate range', () => {
      expect(html).toContain('Estymata');
      // formatPLN uses Intl with currency:'PLN' which outputs "zl" symbol, not "PLN" text
      expect(html).toContain('50');
      expect(html).toContain('80');
      expect(html).toContain('z\u0142');
    });

    it('contains primary image', () => {
      expect(html).toContain('https://cdn.omena.pl/lot-001-large.jpg');
      expect(html).toContain('<img');
    });

    it('contains footer with disclaimer', () => {
      expect(html).toContain('Omena Dom Aukcyjny');
      expect(html).toContain('charakter wy\u0142\u0105cznie informacyjny');
    });

    it('contains hidden filename hint', () => {
      expect(html).toContain('data-filename');
      expect(html).toContain('condition-report');
    });
  });

  describe('with minimal data (null fields)', () => {
    const minimalLot = makeLot({
      year: null,
      conditionNotes: null,
      provenance: [],
      medium: '',
      dimensions: '',
      artist: '',
    });

    const html = generateConditionReportHTML(minimalLot, makeAuction(), null);

    it('still returns valid HTML', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('shows dash for missing year', () => {
      // Year should show "—" when null
      expect(html).toContain('\u2014');
    });

    it('shows empty condition notes message', () => {
      expect(html).toContain('Brak uwag dotycz\u0105cych stanu zachowania.');
    });

    it('shows unknown provenance message', () => {
      expect(html).toContain('Proweniencja nieznana.');
    });

    it('shows dash for empty medium', () => {
      // Empty medium should show "—"
      expect(html).toContain('\u2014');
    });

    it('does not contain image tag when no media provided', () => {
      expect(html).not.toContain('<img');
    });
  });

  describe('image URL fallback', () => {
    it('prefers largeUrl', () => {
      const media = makeMedia({ largeUrl: 'https://cdn.omena.pl/large.jpg' });
      const html = generateConditionReportHTML(makeLot(), makeAuction(), media);
      expect(html).toContain('https://cdn.omena.pl/large.jpg');
    });

    it('falls back to mediumUrl when largeUrl is null', () => {
      const media = makeMedia({ largeUrl: null, mediumUrl: 'https://cdn.omena.pl/medium.jpg' });
      const html = generateConditionReportHTML(makeLot(), makeAuction(), media);
      expect(html).toContain('https://cdn.omena.pl/medium.jpg');
    });

    it('falls back to url when both largeUrl and mediumUrl are null', () => {
      const media = makeMedia({ largeUrl: null, mediumUrl: null, url: 'https://cdn.omena.pl/original.jpg' });
      const html = generateConditionReportHTML(makeLot(), makeAuction(), media);
      expect(html).toContain('https://cdn.omena.pl/original.jpg');
    });
  });

  describe('HTML escaping', () => {
    it('escapes special characters in lot title', () => {
      const lot = makeLot({ title: 'Obraz <script>alert("XSS")</script>' });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes special characters in artist name', () => {
      const lot = makeLot({ artist: 'Jan "Wielki" & Syn' });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;Wielki&quot;');
    });

    it('escapes ampersands in auction title', () => {
      const auction = makeAuction({ title: 'Sztuka & Antyki' });
      const html = generateConditionReportHTML(makeLot(), auction, null);
      expect(html).toContain('Sztuka &amp; Antyki');
    });

    it('escapes HTML in condition notes', () => {
      const lot = makeLot({ conditionNotes: 'Stan: <b>dobry</b>' });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).not.toContain('<b>dobry</b>');
      expect(html).toContain('&lt;b&gt;dobry&lt;/b&gt;');
    });

    it('escapes HTML in provenance entries', () => {
      const lot = makeLot({ provenance: ['Galeria "Pod Okiem"', 'Zbiory A & B'] });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).toContain('&quot;Pod Okiem&quot;');
      expect(html).toContain('A &amp; B');
    });

    it('escapes quotes in image URL', () => {
      const media = makeMedia({ largeUrl: 'https://cdn.omena.pl/img?id="1"' });
      const html = generateConditionReportHTML(makeLot(), makeAuction(), media);
      expect(html).toContain('&quot;1&quot;');
    });
  });

  describe('provenance handling for non-array values', () => {
    it('handles provenance as null', () => {
      const lot = makeLot({ provenance: null as unknown });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).toContain('Proweniencja nieznana.');
    });

    it('handles provenance as undefined', () => {
      const lot = makeLot({ provenance: undefined as unknown });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).toContain('Proweniencja nieznana.');
    });

    it('handles provenance as a string (not array)', () => {
      const lot = makeLot({ provenance: 'some string' as unknown });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      // toStringArray filters out non-string-array values
      expect(html).toContain('Proweniencja nieznana.');
    });

    it('filters out non-string items in provenance array', () => {
      const lot = makeLot({ provenance: ['Valid entry', 42, null, 'Another valid'] as unknown });
      const html = generateConditionReportHTML(lot, makeAuction(), null);
      expect(html).toContain('Valid entry');
      expect(html).toContain('Another valid');
    });
  });

  describe('auction date handling', () => {
    it('handles string dates for auction startDate', () => {
      const auction = makeAuction({ startDate: '2026-06-01T10:00:00Z' });
      const html = generateConditionReportHTML(makeLot(), auction, null);
      expect(html).toContain('2026');
    });
  });
});

// ─── generateBatchConditionReportHTML ────────────────────────────────────────

describe('generateBatchConditionReportHTML', () => {
  describe('empty batch', () => {
    const html = generateBatchConditionReportHTML(makeAuction(), []);

    it('returns valid HTML document', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('contains "Brak lotow" message', () => {
      expect(html).toContain('Brak lot\u00F3w');
    });

    it('contains auction title', () => {
      expect(html).toContain('Aukcja Sztuki Polskiej');
    });

    it('contains OMENA branding', () => {
      expect(html).toContain('OMENA');
    });
  });

  describe('single item batch', () => {
    const items: BatchConditionReportItem[] = [
      { lot: makeLot(), primaryMedia: makeMedia() },
    ];
    const html = generateBatchConditionReportHTML(makeAuction(), items);

    it('returns valid HTML document', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('contains lot data', () => {
      expect(html).toContain('Pejzaz nadmorski');
      expect(html).toContain('Jan Matejko');
    });

    it('contains cover page with items count', () => {
      expect(html).toContain('1 lot');
    });

    it('does not have page-break before first item', () => {
      // The first item (idx=0) should not have page-break
      const firstPageBreakIdx = html.indexOf('page-break');
      // page-break should only appear in CSS definitions, not as a class on the first item
      // Actually the CSS does have .page-break class. Check there's no div with page-break before lot content
      const reportPageIdx = html.indexOf('report-page');
      const pageBreakDivIdx = html.indexOf('<div class="page-break">');
      // With a single item, there should be no page-break div
      expect(pageBreakDivIdx).toBe(-1);
    });
  });

  describe('multi-item batch', () => {
    const items: BatchConditionReportItem[] = [
      { lot: makeLot({ lotNumber: 1, title: 'Lot Pierwszy' }), primaryMedia: makeMedia() },
      { lot: makeLot({ lotNumber: 2, title: 'Lot Drugi', artist: 'Artysta B' }), primaryMedia: null },
      { lot: makeLot({ lotNumber: 3, title: 'Lot Trzeci', conditionNotes: null }), primaryMedia: makeMedia() },
    ];
    const html = generateBatchConditionReportHTML(makeAuction(), items);

    it('contains all lot titles', () => {
      expect(html).toContain('Lot Pierwszy');
      expect(html).toContain('Lot Drugi');
      expect(html).toContain('Lot Trzeci');
    });

    it('contains page breaks between items', () => {
      const pageBreakCount = (html.match(/<div class="page-break"><\/div>/g) || []).length;
      // Page breaks between items: for 3 items, 2 page breaks (before item 2 and 3)
      expect(pageBreakCount).toBe(2);
    });

    it('contains cover page header', () => {
      expect(html).toContain('Raporty Stanu');
      expect(html).toContain('Condition Reports');
    });

    it('states the total number of lots', () => {
      expect(html).toContain('3 lot');
    });

    it('contains hidden filename hint with slug', () => {
      expect(html).toContain('data-filename');
      expect(html).toContain('condition-reports.html');
    });

    it('each item has its own header', () => {
      // Each report-page should have OMENA branding
      const omenaCount = (html.match(/class="brand-name">OMENA/g) || []).length;
      // Cover page (1) + 3 items = 4 OMENA headers
      expect(omenaCount).toBe(4);
    });

    it('contains footer for each item', () => {
      const footerCount = (html.match(/class="footer"/g) || []).length;
      expect(footerCount).toBe(3);
    });
  });

  describe('with no media for any items', () => {
    const items: BatchConditionReportItem[] = [
      { lot: makeLot(), primaryMedia: null },
    ];
    const html = generateBatchConditionReportHTML(makeAuction(), items);

    it('does not contain img tags', () => {
      expect(html).not.toContain('<img');
    });
  });

  describe('HTML escaping in batch', () => {
    it('escapes auction title in batch header', () => {
      const auction = makeAuction({ title: 'Aukcja <Specjalna>' });
      const html = generateBatchConditionReportHTML(auction, []);
      expect(html).toContain('Aukcja &lt;Specjalna&gt;');
      expect(html).not.toContain('<Specjalna>');
    });
  });
});
