import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock PDFKit ──────────────────────────────────────────────────────────────

let addPageCallCount = 0;

vi.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  class MockDoc extends EventEmitter {
    constructor() {
      super();
      addPageCallCount = 0;
    }
    addPage() {
      addPageCallCount++;
      return this;
    }
    rect() { return this; }
    fill() { return this; }
    font() { return this; }
    fontSize() { return this; }
    fillColor() { return this; }
    text() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    lineWidth() { return this; }
    strokeColor() { return this; }
    stroke() { return this; }
    image() { return this; }
    heightOfString() { return 20; }
    end() {
      process.nextTick(() => {
        this.emit('data', Buffer.from('fake-pdf-content'));
        this.emit('end');
      });
    }
  }
  return { default: MockDoc };
});

// ─── Mock http/https for fetchImageBuffer ─────────────────────────────────────

vi.mock('https', () => {
  const { EventEmitter } = require('events');
  return {
    get: vi.fn((_url: string, _opts: unknown, cb: Function) => {
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });
      const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
      process.nextTick(() => {
        cb(res);
        res.emit('data', Buffer.from('fake-image-bytes'));
        res.emit('end');
      });
      return req;
    }),
  };
});

vi.mock('http', () => {
  const { EventEmitter } = require('events');
  return {
    get: vi.fn((_url: string, _opts: unknown, cb: Function) => {
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });
      const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
      process.nextTick(() => {
        cb(res);
        res.emit('data', Buffer.from('fake-image-bytes'));
        res.emit('end');
      });
      return req;
    }),
  };
});

import {
  generateCatalogPdf,
  type CatalogLot,
  type CatalogAuction,
} from '@/lib/catalog-pdf';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuction(overrides?: Partial<CatalogAuction>): CatalogAuction {
  return {
    title: 'Aukcja Sztuki Polskiej',
    date: '15 marca 2026',
    location: 'Warszawa, ul. Marszalkowska 1',
    curator: 'Jan Kowalski',
    description: 'Niezwykla kolekcja dziel sztuki polskiej XX wieku.',
    ...overrides,
  };
}

function makeLot(overrides?: Partial<CatalogLot>): CatalogLot {
  return {
    lotNumber: 1,
    title: 'Pejzaz z Wisla',
    artist: 'Jozef Mehoffer',
    medium: 'olej na plotnie',
    dimensions: '80 x 120 cm',
    year: 1920,
    description: 'Piekny pejzaz przedstawiajacy Wisle o zachodzie slonca.',
    estimateMin: 50000,
    estimateMax: 80000,
    provenance: ['Kolekcja prywatna', 'Desa Unicum 2019'],
    primaryImageUrl: 'https://example.com/image1.jpg',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('catalog-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addPageCallCount = 0;
  });

  describe('generateCatalogPdf', () => {
    it('returns a Buffer', async () => {
      const result = await generateCatalogPdf(makeAuction(), []);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('produces a cover page with empty lots array', async () => {
      const result = await generateCatalogPdf(makeAuction(), []);
      expect(result).toBeInstanceOf(Buffer);
      // With 0 lots: 1 addPage for cover, no TOC, no lot pages
      expect(addPageCallCount).toBe(1);
    });

    it('produces cover + TOC + lot pages for multiple lots', async () => {
      const lots = [
        makeLot({ lotNumber: 1 }),
        makeLot({ lotNumber: 2, title: 'Portret Damy' }),
        makeLot({ lotNumber: 3, title: 'Martwa Natura' }),
      ];

      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
      // 1 cover + 1 TOC + 3 lot pages = 5
      expect(addPageCallCount).toBe(5);
    });

    it('produces correct page count for a single lot', async () => {
      const lots = [makeLot({ lotNumber: 1 })];
      await generateCatalogPdf(makeAuction(), lots);
      // 1 cover + 1 TOC + 1 lot page = 3
      expect(addPageCallCount).toBe(3);
    });

    it('handles lots without images (null primaryImageUrl)', async () => {
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: null })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles lots without provenance', async () => {
      const lots = [makeLot({ lotNumber: 1, provenance: [] })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles lots without description', async () => {
      const lots = [makeLot({ lotNumber: 1, description: '' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles auction without optional fields', async () => {
      const auction = makeAuction({
        location: '',
        curator: '',
        description: '',
      });
      const result = await generateCatalogPdf(auction, []);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('CatalogLot type', () => {
    it('has all expected fields', () => {
      const lot = makeLot();
      expect(lot).toHaveProperty('lotNumber');
      expect(lot).toHaveProperty('title');
      expect(lot).toHaveProperty('artist');
      expect(lot).toHaveProperty('medium');
      expect(lot).toHaveProperty('dimensions');
      expect(lot).toHaveProperty('year');
      expect(lot).toHaveProperty('description');
      expect(lot).toHaveProperty('estimateMin');
      expect(lot).toHaveProperty('estimateMax');
      expect(lot).toHaveProperty('provenance');
      expect(lot).toHaveProperty('primaryImageUrl');
      expect(typeof lot.lotNumber).toBe('number');
      expect(typeof lot.estimateMin).toBe('number');
      expect(Array.isArray(lot.provenance)).toBe(true);
    });
  });

  describe('CatalogAuction type', () => {
    it('has all expected fields', () => {
      const auction = makeAuction();
      expect(auction).toHaveProperty('title');
      expect(auction).toHaveProperty('date');
      expect(auction).toHaveProperty('location');
      expect(auction).toHaveProperty('curator');
      expect(auction).toHaveProperty('description');
      expect(typeof auction.title).toBe('string');
      expect(typeof auction.date).toBe('string');
    });
  });
});
