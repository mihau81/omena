import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock PDFKit ──────────────────────────────────────────────────────────────

const mockTextCalls: string[] = [];

vi.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  class MockDoc extends EventEmitter {
    y = 200;
    constructor() {
      super();
      mockTextCalls.length = 0;
    }
    rect() { return this; }
    fill() { return this; }
    font() { return this; }
    fontSize() { return this; }
    fillColor() { return this; }
    text(str: string) { mockTextCalls.push(str); return this; }
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

import { amountInWords, generateInvoiceHTML, generateInvoicePdf } from '@/lib/invoice-pdf';
import type { CompanySettings } from '@/lib/invoice-pdf';
import type { InvoiceWithDetails } from '@/lib/invoice-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  return {
    id: 'inv-001',
    invoiceNumber: 'OMENAA/2024/001',
    userId: 'user-1',
    auctionId: 'auction-1',
    lotId: 'lot-1',
    hammerPrice: 5000,
    buyersPremium: 1000,
    totalAmount: 6000,
    currency: 'PLN',
    status: 'pending',
    dueDate: '2024-12-31T00:00:00.000Z',
    paidAt: null,
    notes: null,
    createdAt: '2024-11-01T00:00:00.000Z',
    updatedAt: '2024-11-01T00:00:00.000Z',
    userName: 'Jan Kowalski',
    userEmail: 'jan@example.com',
    userAddress: 'ul. Testowa 5',
    userCity: 'Poznań',
    userPostalCode: '61-001',
    userCountry: 'Polska',
    lotTitle: 'Obraz olejny XIX w.',
    lotNumber: 42,
    auctionTitle: 'Aukcja Zimowa 2024',
    auctionSlug: 'aukcja-zimowa-2024',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<CompanySettings> = {}): CompanySettings {
  return {
    company_name: 'Omenaa Dom Aukcyjny Sp. z o.o.',
    company_address: 'ul. Przykładowa 1',
    company_city: 'Warszawa',
    company_postal_code: '00-001',
    company_country: 'Polska',
    company_nip: '000-000-00-00',
    company_bank_account: 'PL 00 0000 0000 0000 0000 0000 0000',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// amountInWords — Polish number-to-words for PLN
// ═══════════════════════════════════════════════════════════════════════════════

describe('amountInWords', () => {
  // ── Zero ───────────────────────────────────────────────────────────────────

  describe('zero', () => {
    it('returns "zero złotych" for 0', () => {
      expect(amountInWords(0)).toBe('zero złotych');
    });
  });

  // ── Ones (1-9) ─────────────────────────────────────────────────────────────

  describe('single digits (1-9)', () => {
    it('returns "jeden złotych" for 1', () => {
      expect(amountInWords(1)).toBe('jeden złotych');
    });

    it('returns "dwa złotych" for 2', () => {
      expect(amountInWords(2)).toBe('dwa złotych');
    });

    it('returns "trzy złotych" for 3', () => {
      expect(amountInWords(3)).toBe('trzy złotych');
    });

    it('returns "cztery złotych" for 4', () => {
      expect(amountInWords(4)).toBe('cztery złotych');
    });

    it('returns "pięć złotych" for 5', () => {
      expect(amountInWords(5)).toBe('pięć złotych');
    });

    it('returns "sześć złotych" for 6', () => {
      expect(amountInWords(6)).toBe('sześć złotych');
    });

    it('returns "siedem złotych" for 7', () => {
      expect(amountInWords(7)).toBe('siedem złotych');
    });

    it('returns "osiem złotych" for 8', () => {
      expect(amountInWords(8)).toBe('osiem złotych');
    });

    it('returns "dziewięć złotych" for 9', () => {
      expect(amountInWords(9)).toBe('dziewięć złotych');
    });
  });

  // ── Teens (10-19) ──────────────────────────────────────────────────────────

  describe('teens (10-19)', () => {
    it('returns "dziesięć złotych" for 10', () => {
      expect(amountInWords(10)).toBe('dziesięć złotych');
    });

    it('returns "jedenaście złotych" for 11', () => {
      expect(amountInWords(11)).toBe('jedenaście złotych');
    });

    it('returns "dwanaście złotych" for 12', () => {
      expect(amountInWords(12)).toBe('dwanaście złotych');
    });

    it('returns "trzynaście złotych" for 13', () => {
      expect(amountInWords(13)).toBe('trzynaście złotych');
    });

    it('returns "czternaście złotych" for 14', () => {
      expect(amountInWords(14)).toBe('czternaście złotych');
    });

    it('returns "piętnaście złotych" for 15', () => {
      expect(amountInWords(15)).toBe('piętnaście złotych');
    });

    it('returns "dziewiętnaście złotych" for 19', () => {
      expect(amountInWords(19)).toBe('dziewiętnaście złotych');
    });
  });

  // ── Tens (20-90) ───────────────────────────────────────────────────────────

  describe('tens (20-90)', () => {
    it('returns "dwadzieścia złotych" for 20', () => {
      expect(amountInWords(20)).toBe('dwadzieścia złotych');
    });

    it('returns "dwadzieścia jeden złotych" for 21', () => {
      expect(amountInWords(21)).toBe('dwadzieścia jeden złotych');
    });

    it('returns "dwadzieścia dwa złotych" for 22', () => {
      expect(amountInWords(22)).toBe('dwadzieścia dwa złotych');
    });

    it('returns "trzydzieści złotych" for 30', () => {
      expect(amountInWords(30)).toBe('trzydzieści złotych');
    });

    it('returns "czterdzieści złotych" for 40', () => {
      expect(amountInWords(40)).toBe('czterdzieści złotych');
    });

    it('returns "pięćdziesiąt złotych" for 50', () => {
      expect(amountInWords(50)).toBe('pięćdziesiąt złotych');
    });

    it('returns "dziewięćdziesiąt dziewięć złotych" for 99', () => {
      expect(amountInWords(99)).toBe('dziewięćdziesiąt dziewięć złotych');
    });
  });

  // ── Hundreds (100-999) ─────────────────────────────────────────────────────

  describe('hundreds (100-999)', () => {
    it('returns "sto złotych" for 100', () => {
      expect(amountInWords(100)).toBe('sto złotych');
    });

    it('returns "sto jeden złotych" for 101', () => {
      expect(amountInWords(101)).toBe('sto jeden złotych');
    });

    it('returns "sto dziesięć złotych" for 110', () => {
      expect(amountInWords(110)).toBe('sto dziesięć złotych');
    });

    it('returns "sto jedenaście złotych" for 111', () => {
      expect(amountInWords(111)).toBe('sto jedenaście złotych');
    });

    it('returns "dwieście złotych" for 200', () => {
      expect(amountInWords(200)).toBe('dwieście złotych');
    });

    it('returns "trzysta złotych" for 300', () => {
      expect(amountInWords(300)).toBe('trzysta złotych');
    });

    it('returns "czterysta złotych" for 400', () => {
      expect(amountInWords(400)).toBe('czterysta złotych');
    });

    it('returns "pięćset złotych" for 500', () => {
      expect(amountInWords(500)).toBe('pięćset złotych');
    });

    it('returns "dziewięćset dziewięćdziesiąt dziewięć złotych" for 999', () => {
      expect(amountInWords(999)).toBe('dziewięćset dziewięćdziesiąt dziewięć złotych');
    });
  });

  // ── Thousands (1000-999999) ────────────────────────────────────────────────

  describe('thousands', () => {
    it('returns "jeden tysiąc złotych" for 1000', () => {
      expect(amountInWords(1000)).toBe('jeden tysiąc złotych');
    });

    it('returns "jeden tysiąc jeden złotych" for 1001', () => {
      expect(amountInWords(1001)).toBe('jeden tysiąc jeden złotych');
    });

    it('returns "jeden tysiąc dwieście trzydzieści cztery złotych" for 1234', () => {
      expect(amountInWords(1234)).toBe('jeden tysiąc dwieście trzydzieści cztery złotych');
    });

    it('returns "dwa tysiące złotych" for 2000 (tysiące for 2-4)', () => {
      expect(amountInWords(2000)).toBe('dwa tysiące złotych');
    });

    it('returns "trzy tysiące złotych" for 3000', () => {
      expect(amountInWords(3000)).toBe('trzy tysiące złotych');
    });

    it('returns "cztery tysiące złotych" for 4000', () => {
      expect(amountInWords(4000)).toBe('cztery tysiące złotych');
    });

    it('returns "pięć tysięcy złotych" for 5000 (tysięcy for 5+)', () => {
      expect(amountInWords(5000)).toBe('pięć tysięcy złotych');
    });

    it('returns "dziesięć tysięcy złotych" for 10000', () => {
      expect(amountInWords(10000)).toBe('dziesięć tysięcy złotych');
    });

    it('returns "jedenaście tysięcy złotych" for 11000', () => {
      expect(amountInWords(11000)).toBe('jedenaście tysięcy złotych');
    });

    it('returns "dwanaście tysięcy złotych" for 12000 (teen thousands use tysięcy)', () => {
      expect(amountInWords(12000)).toBe('dwanaście tysięcy złotych');
    });

    it('returns "trzynaście tysięcy złotych" for 13000', () => {
      expect(amountInWords(13000)).toBe('trzynaście tysięcy złotych');
    });

    it('returns "czternaście tysięcy złotych" for 14000', () => {
      expect(amountInWords(14000)).toBe('czternaście tysięcy złotych');
    });

    it('returns "dwadzieścia tysięcy złotych" for 20000', () => {
      expect(amountInWords(20000)).toBe('dwadzieścia tysięcy złotych');
    });

    it('returns "dwadzieścia dwa tysiące złotych" for 22000 (22 -> tysiące)', () => {
      expect(amountInWords(22000)).toBe('dwadzieścia dwa tysiące złotych');
    });

    it('returns "dwadzieścia trzy tysiące złotych" for 23000', () => {
      expect(amountInWords(23000)).toBe('dwadzieścia trzy tysiące złotych');
    });

    it('returns "dwadzieścia cztery tysiące złotych" for 24000', () => {
      expect(amountInWords(24000)).toBe('dwadzieścia cztery tysiące złotych');
    });

    it('returns "dwadzieścia pięć tysięcy złotych" for 25000', () => {
      expect(amountInWords(25000)).toBe('dwadzieścia pięć tysięcy złotych');
    });

    it('returns "sto tysięcy złotych" for 100000', () => {
      expect(amountInWords(100000)).toBe('sto tysięcy złotych');
    });

    it('returns correct output for 999999', () => {
      expect(amountInWords(999999)).toBe(
        'dziewięćset dziewięćdziesiąt dziewięć tysięcy dziewięćset dziewięćdziesiąt dziewięć złotych'
      );
    });

    it('returns "sto dwadzieścia trzy tysiące czterysta pięćdziesiąt sześć złotych" for 123456', () => {
      expect(amountInWords(123456)).toBe(
        'sto dwadzieścia trzy tysiące czterysta pięćdziesiąt sześć złotych'
      );
    });
  });

  // ── Millions (1000000+) ────────────────────────────────────────────────────

  describe('millions', () => {
    it('returns "jeden milion złotych" for 1000000', () => {
      expect(amountInWords(1_000_000)).toBe('jeden milion złotych');
    });

    it('returns "dwa miliony złotych" for 2000000 (miliony for 2-4)', () => {
      expect(amountInWords(2_000_000)).toBe('dwa miliony złotych');
    });

    it('returns "trzy miliony złotych" for 3000000', () => {
      expect(amountInWords(3_000_000)).toBe('trzy miliony złotych');
    });

    it('returns "cztery miliony złotych" for 4000000', () => {
      expect(amountInWords(4_000_000)).toBe('cztery miliony złotych');
    });

    it('returns "pięć milionów złotych" for 5000000 (milionów for 5+)', () => {
      expect(amountInWords(5_000_000)).toBe('pięć milionów złotych');
    });

    it('returns "dziesięć milionów złotych" for 10000000', () => {
      expect(amountInWords(10_000_000)).toBe('dziesięć milionów złotych');
    });

    it('handles complex millions with thousands and rest', () => {
      // 1,234,567 = jeden milion dwieście trzydzieści cztery tysiące pięćset sześćdziesiąt siedem
      expect(amountInWords(1_234_567)).toBe(
        'jeden milion dwieście trzydzieści cztery tysiące pięćset sześćdziesiąt siedem złotych'
      );
    });

    it('returns correct output for millions with only rest (no thousands)', () => {
      // 1,000,001 = jeden milion jeden
      expect(amountInWords(1_000_001)).toBe('jeden milion jeden złotych');
    });

    it('returns correct output for millions with only thousands (no rest)', () => {
      // 1,001,000 = jeden milion jeden tysiąc
      expect(amountInWords(1_001_000)).toBe('jeden milion jeden tysiąc złotych');
    });
  });

  // ── Decimal amounts (rounding behavior) ────────────────────────────────────

  describe('decimal amounts (rounding)', () => {
    it('rounds 100.50 to 101', () => {
      // Math.round(100.50) === 101 in JavaScript (round half up)
      // Note: JS Math.round(0.5) = 1, Math.round(100.5) = 101
      expect(amountInWords(100.5)).toBe('sto jeden złotych');
    });

    it('rounds 1234.99 to 1235', () => {
      expect(amountInWords(1234.99)).toBe(
        'jeden tysiąc dwieście trzydzieści pięć złotych'
      );
    });

    it('rounds 0.01 to 0 (zero)', () => {
      expect(amountInWords(0.01)).toBe('zero złotych');
    });

    it('rounds 0.49 to 0 (zero)', () => {
      expect(amountInWords(0.49)).toBe('zero złotych');
    });

    it('rounds 0.5 to 1 (rounds up at half)', () => {
      // Math.round(0.5) === 1
      expect(amountInWords(0.5)).toBe('jeden złotych');
    });

    it('rounds 1.00 to 1', () => {
      expect(amountInWords(1.0)).toBe('jeden złotych');
    });

    it('rounds 999.4 to 999', () => {
      expect(amountInWords(999.4)).toBe(
        'dziewięćset dziewięćdziesiąt dziewięć złotych'
      );
    });

    it('rounds 999.5 to 1000', () => {
      expect(amountInWords(999.5)).toBe('jeden tysiąc złotych');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns "szesnaście złotych" for 16', () => {
      expect(amountInWords(16)).toBe('szesnaście złotych');
    });

    it('returns "siedemnaście złotych" for 17', () => {
      expect(amountInWords(17)).toBe('siedemnaście złotych');
    });

    it('returns "osiemnaście złotych" for 18', () => {
      expect(amountInWords(18)).toBe('osiemnaście złotych');
    });

    it('returns correct for 112 (sto dwanaście)', () => {
      expect(amountInWords(112)).toBe('sto dwanaście złotych');
    });

    it('returns correct for 212 (dwieście dwanaście)', () => {
      expect(amountInWords(212)).toBe('dwieście dwanaście złotych');
    });

    it('returns "sześćset złotych" for 600', () => {
      expect(amountInWords(600)).toBe('sześćset złotych');
    });

    it('returns "siedemset złotych" for 700', () => {
      expect(amountInWords(700)).toBe('siedemset złotych');
    });

    it('returns "osiemset złotych" for 800', () => {
      expect(amountInWords(800)).toBe('osiemset złotych');
    });

    it('returns "dziewięćset złotych" for 900', () => {
      expect(amountInWords(900)).toBe('dziewięćset złotych');
    });

    it('handles 1111 — one thousand one hundred eleven', () => {
      expect(amountInWords(1111)).toBe('jeden tysiąc sto jedenaście złotych');
    });

    it('handles 12000 — teen thousands use tysięcy (not tysiące)', () => {
      // 12 ends in 12 so it is a teen exception -> tysięcy
      expect(amountInWords(12000)).toBe('dwanaście tysięcy złotych');
    });

    it('handles 112000 — sto dwanaście tysięcy (last2=12 -> tysięcy)', () => {
      expect(amountInWords(112000)).toBe('sto dwanaście tysięcy złotych');
    });

    it('handles 113000 — sto trzynaście tysięcy', () => {
      expect(amountInWords(113000)).toBe('sto trzynaście tysięcy złotych');
    });

    it('handles 114000 — sto czternaście tysięcy', () => {
      expect(amountInWords(114000)).toBe('sto czternaście tysięcy złotych');
    });
  });

  // ── Suffix is always "złotych" ─────────────────────────────────────────────

  describe('suffix is always "złotych"', () => {
    it('uses "złotych" for 0', () => {
      expect(amountInWords(0)).toMatch(/złotych$/);
    });

    it('uses "złotych" for 1', () => {
      expect(amountInWords(1)).toMatch(/złotych$/);
    });

    it('uses "złotych" for 5', () => {
      expect(amountInWords(5)).toMatch(/złotych$/);
    });

    it('uses "złotych" for 100', () => {
      expect(amountInWords(100)).toMatch(/złotych$/);
    });

    it('uses "złotych" for 1000000', () => {
      expect(amountInWords(1_000_000)).toMatch(/złotych$/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateInvoiceHTML
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateInvoiceHTML', () => {
  describe('HTML structure', () => {
    it('returns a valid HTML document', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="pl">');
      expect(html).toContain('</html>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
    });

    it('includes the invoice number in the title', () => {
      const html = generateInvoiceHTML(makeInvoice({ invoiceNumber: 'OMENAA/2024/007' }));
      expect(html).toContain('<title>Faktura OMENAA/2024/007</title>');
    });

    it('includes the invoice number in the meta block', () => {
      const html = generateInvoiceHTML(makeInvoice({ invoiceNumber: 'OMENAA/2024/042' }));
      expect(html).toContain('OMENAA/2024/042');
    });

    it('contains the brand name OMENAA', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('OMENAA');
      expect(html).toContain('Dom Aukcyjny');
    });

    it('includes a table for lot details', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
    });

    it('includes the footer with company info', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Omenaa Dom Aukcyjny');
      expect(html).toContain('NIP: 000-000-00-00');
      expect(html).toContain('KRS: 0000000000');
    });

    it('includes CSS styles', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('includes print media query', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('@media print');
    });
  });

  describe('buyer information', () => {
    it('renders buyer name', () => {
      const html = generateInvoiceHTML(makeInvoice({ userName: 'Anna Nowak' }));
      expect(html).toContain('Anna Nowak');
    });

    it('renders buyer email', () => {
      const html = generateInvoiceHTML(makeInvoice({ userEmail: 'anna@test.pl' }));
      expect(html).toContain('anna@test.pl');
    });

    it('renders full buyer address when all fields present', () => {
      const html = generateInvoiceHTML(makeInvoice({
        userAddress: 'ul. Kwiatowa 10',
        userPostalCode: '00-001',
        userCity: 'Warszawa',
        userCountry: 'Polska',
      }));
      expect(html).toContain('ul. Kwiatowa 10');
      expect(html).toContain('00-001 Warszawa');
      expect(html).toContain('Polska');
    });

    it('renders address without postal code when missing', () => {
      const html = generateInvoiceHTML(makeInvoice({
        userAddress: 'ul. Testowa 1',
        userPostalCode: null,
        userCity: 'Kraków',
        userCountry: null,
      }));
      expect(html).toContain('ul. Testowa 1');
      expect(html).toContain('Kraków');
    });

    it('renders address without city when missing', () => {
      const html = generateInvoiceHTML(makeInvoice({
        userAddress: 'ul. Testowa 1',
        userPostalCode: '60-001',
        userCity: null,
        userCountry: null,
      }));
      expect(html).toContain('ul. Testowa 1');
      expect(html).toContain('60-001');
    });

    it('renders with no address fields at all', () => {
      const html = generateInvoiceHTML(makeInvoice({
        userAddress: null,
        userPostalCode: null,
        userCity: null,
        userCountry: null,
      }));
      expect(html).toContain('Jan Kowalski');
    });
  });

  describe('lot details', () => {
    it('renders lot number', () => {
      const html = generateInvoiceHTML(makeInvoice({ lotNumber: 99 }));
      expect(html).toContain('99');
    });

    it('renders lot title', () => {
      const html = generateInvoiceHTML(makeInvoice({ lotTitle: 'Rzeźba z brązu' }));
      expect(html).toContain('Rzeźba z brązu');
    });

    it('renders auction title', () => {
      const html = generateInvoiceHTML(makeInvoice({ auctionTitle: 'Wielka Aukcja Sztuki' }));
      expect(html).toContain('Wielka Aukcja Sztuki');
    });
  });

  describe('currency formatting (formatPLN)', () => {
    it('renders hammerPrice formatted in PLN with zł symbol', () => {
      const html = generateInvoiceHTML(makeInvoice({ hammerPrice: 5000 }));
      expect(html).toContain('zł');
      expect(html).toContain('5000');
    });

    it('renders buyersPremium formatted in PLN', () => {
      const html = generateInvoiceHTML(makeInvoice({ buyersPremium: 1000 }));
      expect(html).toContain('zł');
      expect(html).toContain('1000');
    });

    it('renders totalAmount formatted in PLN', () => {
      const html = generateInvoiceHTML(makeInvoice({ totalAmount: 6000 }));
      expect(html).toContain('zł');
      expect(html).toContain('6000');
    });

    it('renders large amounts containing the digits', () => {
      const html = generateInvoiceHTML(makeInvoice({ hammerPrice: 1500000 }));
      expect(html).toContain('zł');
      expect(html).toMatch(/1[,.\s\u00A0]?500[,.\s\u00A0]?000|1500000/);
    });

    it('renders zero amount', () => {
      const html = generateInvoiceHTML(makeInvoice({ hammerPrice: 0, buyersPremium: 0, totalAmount: 0 }));
      expect(html).toContain('0');
    });
  });

  describe('date formatting (formatDate)', () => {
    it('formats createdAt date in Polish', () => {
      const html = generateInvoiceHTML(makeInvoice({ createdAt: '2024-11-01T00:00:00.000Z' }));
      expect(html).toMatch(/listopada|Data wystawienia/i);
    });

    it('formats dueDate in Polish', () => {
      const html = generateInvoiceHTML(makeInvoice({ dueDate: '2024-12-31T00:00:00.000Z' }));
      expect(html).toMatch(/grudnia|Termin płatności/i);
    });

    it('renders em dash when dueDate is null', () => {
      const html = generateInvoiceHTML(makeInvoice({ dueDate: null }));
      expect(html).not.toContain('Termin płatności: <strong>');
    });

    it('shows paidAt date when paid', () => {
      const html = generateInvoiceHTML(makeInvoice({
        status: 'paid',
        paidAt: '2024-11-15T00:00:00.000Z',
      }));
      expect(html).toContain('Opłacono:');
      expect(html).toMatch(/listopada/i);
    });

    it('does not show paidAt section when paidAt is null', () => {
      const html = generateInvoiceHTML(makeInvoice({ paidAt: null }));
      expect(html).not.toContain('Opłacono:');
    });
  });

  describe('status badge (statusLabel)', () => {
    const cases: Array<[string, string, string]> = [
      ['pending', 'Oczekująca', 'status-pending'],
      ['sent', 'Wysłana', 'status-sent'],
      ['paid', 'Opłacona', 'status-paid'],
      ['overdue', 'Przeterminowana', 'status-overdue'],
      ['cancelled', 'Anulowana', 'status-cancelled'],
    ];

    it.each(cases)('renders status "%s" as "%s" with class "%s"', (status, label, cssClass) => {
      const html = generateInvoiceHTML(makeInvoice({ status }));
      expect(html).toContain(label);
      expect(html).toContain(cssClass);
    });

    it('renders unknown status as-is', () => {
      const html = generateInvoiceHTML(makeInvoice({ status: 'unknown_status' }));
      expect(html).toContain('unknown_status');
    });
  });

  describe('totals section', () => {
    it('renders Cena wylicytowana label', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Cena wylicytowana');
    });

    it('renders Opłata aukcyjna label', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Opłata aukcyjna (20%)');
    });

    it('renders Do zapłaty label', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Do zapłaty');
    });
  });

  describe('notes section', () => {
    it('renders notes when present', () => {
      const html = generateInvoiceHTML(makeInvoice({ notes: 'Proszę o płatność do 30 dni.' }));
      expect(html).toContain('Uwagi');
      expect(html).toContain('Proszę o płatność do 30 dni.');
    });

    it('omits notes section when notes is null', () => {
      const html = generateInvoiceHTML(makeInvoice({ notes: null }));
      expect(html).not.toContain('Uwagi');
    });

    it('omits notes section when notes is empty string', () => {
      const html = generateInvoiceHTML(makeInvoice({ notes: '' }));
      expect(html).not.toContain('class="notes"');
    });
  });

  describe('HTML escaping (escapeHtml)', () => {
    it('escapes & in userName', () => {
      const html = generateInvoiceHTML(makeInvoice({ userName: 'Jan & Anna' }));
      expect(html).toContain('Jan &amp; Anna');
      expect(html).not.toContain('Jan & Anna');
    });

    it('escapes < and > in userName', () => {
      const html = generateInvoiceHTML(makeInvoice({ userName: '<script>alert(1)</script>' }));
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes " in lotTitle', () => {
      const html = generateInvoiceHTML(makeInvoice({ lotTitle: 'Obraz "Wiosna"' }));
      expect(html).toContain('Obraz &quot;Wiosna&quot;');
    });

    it("escapes ' in lotTitle", () => {
      const html = generateInvoiceHTML(makeInvoice({ lotTitle: "L'Art Nouveau" }));
      expect(html).toContain('L&#039;Art Nouveau');
    });

    it('escapes HTML in auctionTitle', () => {
      const html = generateInvoiceHTML(makeInvoice({ auctionTitle: '<b>Aukcja</b>' }));
      expect(html).toContain('&lt;b&gt;Aukcja&lt;/b&gt;');
    });

    it('escapes HTML in userEmail', () => {
      const html = generateInvoiceHTML(makeInvoice({ userEmail: 'test<xss>@example.com' }));
      expect(html).toContain('test&lt;xss&gt;@example.com');
    });

    it('escapes HTML in notes', () => {
      const html = generateInvoiceHTML(makeInvoice({ notes: '<script>evil()</script>' }));
      expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    });
  });

  describe('due date section', () => {
    it('shows due date section when dueDate is provided', () => {
      const html = generateInvoiceHTML(makeInvoice({ dueDate: '2024-12-31T00:00:00.000Z' }));
      expect(html).toContain('class="due-date"');
    });

    it('omits due date section when dueDate is null', () => {
      const html = generateInvoiceHTML(makeInvoice({ dueDate: null }));
      expect(html).not.toContain('class="due-date"');
    });
  });

  describe('seller section', () => {
    it('renders Sprzedawca heading', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Sprzedawca');
    });

    it('renders Nabywca heading', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Nabywca');
    });

    it('renders seller company name', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Omenaa Dom Aukcyjny Sp. z o.o.');
    });
  });

  describe('table structure', () => {
    it('includes table headers for lot columns', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('Nr lotu');
      expect(html).toContain('Opis');
      expect(html).toContain('Cena wylicytowana');
      expect(html).toContain('Opłata aukcyjna (20%)');
      expect(html).toContain('Razem');
    });

    it('renders lot number in a table cell', () => {
      const html = generateInvoiceHTML(makeInvoice({ lotNumber: 7 }));
      expect(html).toContain('<td>7</td>');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateInvoicePdf
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateInvoicePdf', () => {
  beforeEach(() => {
    mockTextCalls.length = 0;
  });

  it('returns a Buffer', async () => {
    const result = await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('resolves without error for a standard invoice', async () => {
    await expect(generateInvoicePdf(makeInvoice(), makeSettings())).resolves.toBeDefined();
  });

  it('includes invoice number in text calls', async () => {
    await generateInvoicePdf(makeInvoice({ invoiceNumber: 'OMENAA/2024/099' }), makeSettings());
    expect(mockTextCalls).toContain('OMENAA/2024/099');
  });

  it('includes OMENAA brand text', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('OMENAA');
  });

  it('includes FAKTURA VAT label', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('FAKTURA VAT');
  });

  it('includes DOM AUKCYJNY tagline', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('DOM AUKCYJNY');
  });

  it('includes SPRZEDAWCA label', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('SPRZEDAWCA');
  });

  it('includes NABYWCA label', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('NABYWCA');
  });

  it('includes seller company name from settings', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_name: 'Test Firma Sp. z o.o.' }));
    expect(mockTextCalls).toContain('Test Firma Sp. z o.o.');
  });

  it('includes seller NIP from settings', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_nip: '123-456-78-90' }));
    expect(mockTextCalls).toContain('NIP: 123-456-78-90');
  });

  it('includes buyer name', async () => {
    await generateInvoicePdf(makeInvoice({ userName: 'Maria Wiśniewska' }), makeSettings());
    expect(mockTextCalls).toContain('Maria Wiśniewska');
  });

  it('includes buyer email', async () => {
    await generateInvoicePdf(makeInvoice({ userEmail: 'maria@test.pl' }), makeSettings());
    expect(mockTextCalls).toContain('maria@test.pl');
  });

  it('includes DO ZAPŁATY label', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('DO ZAPŁATY');
  });

  it('includes amount in words (Słownie)', async () => {
    await generateInvoicePdf(makeInvoice({ totalAmount: 6000 }), makeSettings());
    const slownie = mockTextCalls.find((t) => t.startsWith('Słownie:'));
    expect(slownie).toBeDefined();
    expect(slownie).toContain('sześć tysięcy złotych');
  });

  it('includes bank account when provided in settings', async () => {
    const acct = 'PL 12 3456 7890 1234 5678 9012 3456';
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_bank_account: acct }));
    expect(mockTextCalls.some((t) => t.includes(acct))).toBe(true);
  });

  it('omits bank account when not provided in settings', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_bank_account: undefined }));
    expect(mockTextCalls.some((t) => t.includes('Przelew na rachunek'))).toBe(false);
  });

  it('includes paid date when paidAt is set', async () => {
    await generateInvoicePdf(
      makeInvoice({ paidAt: '2024-11-20T00:00:00.000Z' }),
      makeSettings()
    );
    const paidText = mockTextCalls.find((t) => t.startsWith('Opłacono:'));
    expect(paidText).toBeDefined();
  });

  it('omits paid date when paidAt is null', async () => {
    await generateInvoicePdf(makeInvoice({ paidAt: null }), makeSettings());
    const paidText = mockTextCalls.find((t) => t.startsWith('Opłacono:'));
    expect(paidText).toBeUndefined();
  });

  it('includes notes UWAGI section when notes provided', async () => {
    await generateInvoicePdf(makeInvoice({ notes: 'Ważna uwaga' }), makeSettings());
    expect(mockTextCalls).toContain('UWAGI');
    expect(mockTextCalls).toContain('Ważna uwaga');
  });

  it('omits notes section when notes is null', async () => {
    await generateInvoicePdf(makeInvoice({ notes: null }), makeSettings());
    expect(mockTextCalls).not.toContain('UWAGI');
  });

  it('renders lot number as string', async () => {
    await generateInvoicePdf(makeInvoice({ lotNumber: 42 }), makeSettings());
    expect(mockTextCalls).toContain('42');
  });

  it('truncates long lot titles with ellipsis', async () => {
    const longTitle = 'A'.repeat(100);
    await generateInvoicePdf(makeInvoice({ lotTitle: longTitle }), makeSettings());
    const truncated = mockTextCalls.find((t) => t.includes('A') && t.endsWith('…'));
    expect(truncated).toBeDefined();
    // The source uses 55 chars max
    expect(truncated!.length).toBeLessThanOrEqual(56); // 55 + ellipsis char
  });

  it('does not truncate short lot titles', async () => {
    const shortTitle = 'Obraz XYZ';
    await generateInvoicePdf(makeInvoice({ lotTitle: shortTitle }), makeSettings());
    expect(mockTextCalls).toContain(shortTitle);
  });

  it('includes auction title', async () => {
    await generateInvoicePdf(makeInvoice({ auctionTitle: 'Wielka Aukcja 2024' }), makeSettings());
    expect(mockTextCalls).toContain('Wielka Aukcja 2024');
  });

  it('includes table header labels', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('NR');
    expect(mockTextCalls).toContain('OPIS');
    expect(mockTextCalls).toContain('CENA WYLIC.');
    expect(mockTextCalls).toContain('OPŁATA AUK.');
    expect(mockTextCalls).toContain('RAZEM');
  });

  it('includes totals labels', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings());
    expect(mockTextCalls).toContain('Cena wylicytowana');
    expect(mockTextCalls).toContain('Opłata aukcyjna');
  });

  it('defaults seller name to "Omenaa Dom Aukcyjny" when company_name is empty', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_name: '' }));
    expect(mockTextCalls).toContain('Omenaa Dom Aukcyjny');
  });

  it('uses provided company_name when set', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_name: 'Custom Company' }));
    expect(mockTextCalls).toContain('Custom Company');
    expect(mockTextCalls).not.toContain('Omenaa Dom Aukcyjny');
  });

  it('includes dueDate when present', async () => {
    await generateInvoicePdf(
      makeInvoice({ dueDate: '2025-01-15T00:00:00.000Z' }),
      makeSettings()
    );
    const dueDateText = mockTextCalls.find((t) => t.startsWith('Termin płatności:'));
    expect(dueDateText).toBeDefined();
  });

  it('omits dueDate when null', async () => {
    await generateInvoicePdf(makeInvoice({ dueDate: null }), makeSettings());
    const dueDateText = mockTextCalls.find((t) => t.startsWith('Termin płatności:'));
    expect(dueDateText).toBeUndefined();
  });

  it('omits seller NIP when company_nip is empty string', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_nip: '' }));
    const nipText = mockTextCalls.find((t) => t.startsWith('NIP:'));
    expect(nipText).toBeUndefined();
  });

  it('omits seller address when all address fields are empty', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({
      company_address: '',
      company_city: '',
      company_postal_code: '',
      company_country: '',
    }));
    // Should still work without errors
    expect(mockTextCalls).toContain('SPRZEDAWCA');
  });

  it('omits buyer address in PDF when all address fields are null', async () => {
    await generateInvoicePdf(
      makeInvoice({
        userAddress: null,
        userCity: null,
        userPostalCode: null,
        userCountry: null,
      }),
      makeSettings()
    );
    // Should still render buyer name and email
    expect(mockTextCalls).toContain('Jan Kowalski');
    expect(mockTextCalls).toContain('jan@example.com');
  });

  it('footer omits NIP when company_nip is empty', async () => {
    await generateInvoicePdf(makeInvoice(), makeSettings({ company_nip: '' }));
    // Footer should only contain company name, no NIP
    const footerText = mockTextCalls.find((t) => t.includes('Omenaa Dom Aukcyjny Sp. z o.o.') && !t.includes('NIP'));
    expect(footerText).toBeDefined();
  });
});
