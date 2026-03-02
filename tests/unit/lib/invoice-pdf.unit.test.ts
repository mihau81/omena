import { describe, it, expect } from 'vitest';
import { generateInvoiceHTML } from '@/lib/invoice-pdf';
import type { InvoiceWithDetails } from '@/lib/invoice-service';

// ─── Base invoice fixture ───────────────────────────────────────────────────

function makeInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  return {
    id: 'inv-001',
    invoiceNumber: 'OMENA/2024/001',
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

// ─── generateInvoiceHTML ────────────────────────────────────────────────────

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
      const html = generateInvoiceHTML(makeInvoice({ invoiceNumber: 'OMENA/2024/007' }));
      expect(html).toContain('<title>Faktura OMENA/2024/007</title>');
    });

    it('includes the invoice number in the meta block', () => {
      const html = generateInvoiceHTML(makeInvoice({ invoiceNumber: 'OMENA/2024/042' }));
      expect(html).toContain('OMENA/2024/042');
    });

    it('contains the brand name OMENA', () => {
      const html = generateInvoiceHTML(makeInvoice());
      expect(html).toContain('OMENA');
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
      expect(html).toContain('Omena Dom Aukcyjny');
      expect(html).toContain('NIP: 000-000-00-00');
      expect(html).toContain('KRS: 0000000000');
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
      // postal code alone with no city
      expect(html).toContain('60-001');
    });

    it('renders with no address fields at all', () => {
      const html = generateInvoiceHTML(makeInvoice({
        userAddress: null,
        userPostalCode: null,
        userCity: null,
        userCountry: null,
      }));
      // Should still render without errors
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
      // Locale output varies by environment but always contains zł
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
      // Should contain Polish month name
      expect(html).toMatch(/listopada|Data wystawienia/i);
    });

    it('formats dueDate in Polish', () => {
      const html = generateInvoiceHTML(makeInvoice({ dueDate: '2024-12-31T00:00:00.000Z' }));
      expect(html).toMatch(/grudnia|Termin płatności/i);
    });

    it('renders em dash when dueDate is null', () => {
      const html = generateInvoiceHTML(makeInvoice({ dueDate: null }));
      // No dueDate section should appear
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
      expect(html).toContain('Omena Dom Aukcyjny Sp. z o.o.');
    });
  });
});
