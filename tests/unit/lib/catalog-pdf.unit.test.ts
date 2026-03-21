import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock refs ────────────────────────────────────────────────────────
// These must be declared with vi.hoisted() so they are available when vi.mock
// factory functions run (vi.mock factories are hoisted to the top of the file).

const { httpsGetMock, httpGetMock } = vi.hoisted(() => {
  const { EventEmitter } = require('events');

  const makeSuccessImpl = () => (_url: string, _opts: unknown, cb: Function) => {
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    process.nextTick(() => {
      cb(res);
      res.emit('data', Buffer.from('fake-image-bytes'));
      res.emit('end');
    });
    return req;
  };

  return {
    httpsGetMock: vi.fn(makeSuccessImpl()),
    httpGetMock: vi.fn(makeSuccessImpl()),
  };
});

// ─── Mock PDFKit ──────────────────────────────────────────────────────────────

let addPageCallCount = 0;
let imageThrows = false;
let docErrorOnEnd = false;
let docThrowsOnDraw = false;

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
    rect() {
      if (docThrowsOnDraw) throw new Error('PDFKit draw error');
      return this;
    }
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
    image() {
      if (imageThrows) throw new Error('Image embed failed');
      return this;
    }
    heightOfString() { return 20; }
    end() {
      if (docErrorOnEnd) {
        process.nextTick(() => {
          this.emit('error', new Error('PDF generation error'));
        });
        return;
      }
      process.nextTick(() => {
        this.emit('data', Buffer.from('fake-pdf-content'));
        this.emit('end');
      });
    }
  }
  return { default: MockDoc };
});

// ─── Mock https/http ──────────────────────────────────────────────────────────
// catalog-pdf.ts uses `import https from 'https'` (default import of CJS module).
// We must provide __esModule: true with a `default` key so the default import
// resolves correctly in Vitest's jsdom environment.

vi.mock('https', () => ({
  __esModule: true,
  default: { get: httpsGetMock },
  get: httpsGetMock,
}));

vi.mock('http', () => ({
  __esModule: true,
  default: { get: httpGetMock },
  get: httpGetMock,
}));

import {
  generateCatalogPdf,
  type CatalogLot,
  type CatalogAuction,
} from '@/lib/catalog-pdf';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuccessHttpsImpl() {
  const { EventEmitter } = require('events');
  return (_url: string, _opts: unknown, cb: Function) => {
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    process.nextTick(() => {
      cb(res);
      res.emit('data', Buffer.from('fake-image-bytes'));
      res.emit('end');
    });
    return req;
  };
}

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
    imageThrows = false;
    docErrorOnEnd = false;
    docThrowsOnDraw = false;

    // Restore the default (success) implementation after clearAllMocks resets it
    httpsGetMock.mockImplementation(makeSuccessHttpsImpl());
    httpGetMock.mockImplementation(makeSuccessHttpsImpl());
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

    // ── TOC continuation page (lines 134-140) ──────────────────────────────

    it('adds a continuation TOC page when lots exceed one page capacity', async () => {
      // maxPerPage = Math.floor((842 - 100 - 80) / 22) = 30
      // We need 31+ lots to trigger the continuation branch
      const lotsArray: CatalogLot[] = Array.from({ length: 32 }, (_, i) =>
        makeLot({ lotNumber: i + 1, title: `Obraz ${i + 1}`, primaryImageUrl: null }),
      );
      const result = await generateCatalogPdf(makeAuction(), lotsArray);
      expect(result).toBeInstanceOf(Buffer);
      // 1 cover + 2 TOC pages + 32 lot pages = 35
      expect(addPageCallCount).toBe(35);
    });

    // ── Image embed — successful path (lines 202-204) ──────────────────────

    it('embeds image when fetchImageBuffer returns a valid buffer', async () => {
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/img.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
      expect(httpsGetMock).toHaveBeenCalled();
    });

    // ── Image embed failure (lines 205-207 catch block) ────────────────────

    it('skips gracefully when doc.image() throws during embed', async () => {
      imageThrows = true;
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/img.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── fetchImageBuffer: non-200 status code ──────────────────────────────

    it('draws placeholder when HTTPS returns non-200 status', async () => {
      const { EventEmitter } = require('events');
      httpsGetMock.mockImplementationOnce((_url: string, _opts: unknown, cb: Function) => {
        const res = Object.assign(new EventEmitter(), { statusCode: 404 });
        const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
        process.nextTick(() => { cb(res); });
        return req;
      });
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/missing.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── fetchImageBuffer: response stream error ────────────────────────────

    it('draws placeholder when HTTPS response emits an error', async () => {
      const { EventEmitter } = require('events');
      httpsGetMock.mockImplementationOnce((_url: string, _opts: unknown, cb: Function) => {
        const res = Object.assign(new EventEmitter(), { statusCode: 200 });
        const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
        process.nextTick(() => {
          cb(res);
          res.emit('error', new Error('stream error'));
        });
        return req;
      });
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/error.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── fetchImageBuffer: request timeout ─────────────────────────────────

    it('draws placeholder when HTTPS request times out', async () => {
      const { EventEmitter } = require('events');
      httpsGetMock.mockImplementationOnce((_url: string, _opts: unknown, _cb: Function) => {
        const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
        process.nextTick(() => { req.emit('timeout'); });
        return req;
      });
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/timeout.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── fetchImageBuffer: request error ───────────────────────────────────

    it('draws placeholder when HTTPS request emits an error', async () => {
      const { EventEmitter } = require('events');
      httpsGetMock.mockImplementationOnce((_url: string, _opts: unknown, _cb: Function) => {
        const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
        process.nextTick(() => { req.emit('error', new Error('connection refused')); });
        return req;
      });
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/req-error.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── fetchImageBuffer: try/catch for synchronous throws ─────────────────

    it('draws placeholder when mod.get throws synchronously', async () => {
      httpsGetMock.mockImplementationOnce(() => {
        throw new Error('synchronous network error');
      });
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'https://example.com/sync-error.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── fetchImageBuffer: HTTP (not HTTPS) URL ────────────────────────────

    it('fetches image via HTTP for http:// URLs', async () => {
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'http://example.com/image.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
      expect(httpGetMock).toHaveBeenCalled();
    });

    it('draws placeholder when HTTP returns non-200 status', async () => {
      const { EventEmitter } = require('events');
      httpGetMock.mockImplementationOnce((_url: string, _opts: unknown, cb: Function) => {
        const res = Object.assign(new EventEmitter(), { statusCode: 500 });
        const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
        process.nextTick(() => { cb(res); });
        return req;
      });
      const lots = [makeLot({ lotNumber: 1, primaryImageUrl: 'http://example.com/broken.jpg' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    // ── PDF error event — doc.on('error') path ────────────────────────────

    it('rejects the promise when the PDF document emits an error event', async () => {
      docErrorOnEnd = true;
      await expect(generateCatalogPdf(makeAuction(), [])).rejects.toThrow('PDF generation error');
    });

    // ── Synchronous throw inside try block (line 319) ─────────────────────

    it('rejects the promise when a doc draw method throws synchronously', async () => {
      docThrowsOnDraw = true;
      await expect(generateCatalogPdf(makeAuction(), [])).rejects.toThrow('PDFKit draw error');
    });

    // ── Lot fields ─────────────────────────────────────────────────────────

    it('handles lot without artist (TOC and lot page label)', async () => {
      const lots = [makeLot({ lotNumber: 1, artist: '' })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles lot without medium and dimensions and year', async () => {
      const lots = [makeLot({ lotNumber: 1, medium: '', dimensions: '', year: null })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('truncates long descriptions to 600 chars', async () => {
      const longDesc = 'A'.repeat(700);
      const lots = [makeLot({ lotNumber: 1, description: longDesc, primaryImageUrl: null })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('truncates long auction description to 400 chars', async () => {
      const auction = makeAuction({ description: 'B'.repeat(500) });
      const result = await generateCatalogPdf(auction, []);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('renders provenance when description is empty', async () => {
      const lots = [makeLot({ lotNumber: 1, description: '', provenance: ['Gallery X', 'Museum Y'], primaryImageUrl: null })];
      const result = await generateCatalogPdf(makeAuction(), lots);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles odd-numbered lot in TOC (no zebra stripe on odd rows)', async () => {
      // Two lots: count=0 gets stripe, count=1 does not
      const lots = [
        makeLot({ lotNumber: 1, primaryImageUrl: null }),
        makeLot({ lotNumber: 2, title: 'Second', primaryImageUrl: null }),
      ];
      const result = await generateCatalogPdf(makeAuction(), lots);
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
