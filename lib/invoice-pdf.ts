import PDFDocument from 'pdfkit';
import type { InvoiceWithDetails } from './invoice-service';

// ─── Company settings shape ──────────────────────────────────────────────────

export interface CompanySettings {
  company_name: string;
  company_address: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  company_nip: string;
  company_bank_account?: string;
}

// ─── Polish number-to-words (simplified, PLN only) ───────────────────────────

const ONES = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const TEENS = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const TENS = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const HUNDREDS = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const t = Math.floor(rest / 10);
  const o = rest % 10;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (t === 1) {
    parts.push(TEENS[o]);
  } else {
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ONES[o]);
  }
  return parts.join(' ');
}

function numberToWords(n: number): string {
  if (n === 0) return 'zero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;
  const parts: string[] = [];
  if (millions) {
    const w = threeDigits(millions);
    parts.push(`${w} ${millions === 1 ? 'milion' : millions < 5 ? 'miliony' : 'milionów'}`);
  }
  if (thousands) {
    const w = threeDigits(thousands);
    const last2 = thousands % 100;
    const last1 = thousands % 10;
    let suffix = 'tysięcy';
    if (thousands === 1) suffix = 'tysiąc';
    else if (last2 !== 12 && last2 !== 13 && last2 !== 14 && last1 >= 2 && last1 <= 4) suffix = 'tysiące';
    parts.push(`${w} ${suffix}`);
  }
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function amountInWords(amount: number): string {
  const rounded = Math.round(amount);
  return `${numberToWords(rounded)} złotych`;
}

// ─── PDF generation ──────────────────────────────────────────────────────────

export function generateInvoicePdf(
  invoice: InvoiceWithDetails,
  settings: CompanySettings,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Faktura ${invoice.invoiceNumber}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const GOLD = '#c9a84c';
    const DARK = '#1a1a1a';
    const TAUPE = '#8b7355';
    const GRAY = '#555555';
    const W = 495; // usable width (595 - 2*50)

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(28).font('Helvetica-Bold').fillColor(DARK).text('OMENAA', 50, 50);
    doc.fontSize(9).font('Helvetica').fillColor(TAUPE).text('DOM AUKCYJNY', 50, 83);

    // Right side: invoice label + number
    const invMeta = `${invoice.invoiceNumber}`;
    doc.fontSize(9).font('Helvetica').fillColor(TAUPE).text('FAKTURA VAT', 50, 50, { align: 'right', width: W });
    doc.fontSize(14).font('Helvetica-Bold').fillColor(GOLD).text(invMeta, 50, 64, { align: 'right', width: W });

    const dateIssued = formatDate(invoice.createdAt);
    const dateDue = formatDate(invoice.dueDate);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY)
      .text(`Data wystawienia: ${dateIssued}`, 50, 84, { align: 'right', width: W });
    if (invoice.dueDate) {
      doc.text(`Termin płatności: ${dateDue}`, 50, 96, { align: 'right', width: W });
    }

    // Gold separator line
    doc.moveTo(50, 115).lineTo(545, 115).lineWidth(2).strokeColor(GOLD).stroke();

    // ── Seller & Buyer ──────────────────────────────────────────────────────
    const sellerX = 50;
    const buyerX = 310;
    const partyY = 130;

    doc.fontSize(8).font('Helvetica-Bold').fillColor(TAUPE)
      .text('SPRZEDAWCA', sellerX, partyY)
      .text('NABYWCA', buyerX, partyY);

    doc.moveTo(sellerX, partyY + 12).lineTo(260, partyY + 12).lineWidth(0.5).strokeColor('#e8e0d0').stroke();
    doc.moveTo(buyerX, partyY + 12).lineTo(545, partyY + 12).lineWidth(0.5).strokeColor('#e8e0d0').stroke();

    const sellerName = settings.company_name || 'Omenaa Dom Aukcyjny';
    const sellerAddr = [
      settings.company_address,
      [settings.company_postal_code, settings.company_city].filter(Boolean).join(' '),
      settings.company_country,
    ].filter(Boolean).join('\n');
    const sellerNip = settings.company_nip ? `NIP: ${settings.company_nip}` : '';

    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(sellerName, sellerX, partyY + 18, { width: 250 });
    if (sellerAddr) {
      doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(sellerAddr, sellerX, doc.y + 2, { width: 250 });
    }
    if (sellerNip) {
      doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(sellerNip, sellerX, doc.y + 2, { width: 250 });
    }

    const buyerAddr = [
      invoice.userAddress,
      [invoice.userPostalCode, invoice.userCity].filter(Boolean).join(' '),
      invoice.userCountry,
    ].filter(Boolean).join('\n');

    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(invoice.userName, buyerX, partyY + 18, { width: 235 });
    doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(invoice.userEmail, buyerX, doc.y + 2, { width: 235 });
    if (buyerAddr) {
      doc.text(buyerAddr, buyerX, doc.y + 2, { width: 235 });
    }

    // ── Line items table ────────────────────────────────────────────────────
    const tableY = 255;
    const col = { lot: 50, desc: 85, hammer: 305, premium: 385, total: 460 };

    // Table header background
    doc.rect(50, tableY, W, 22).fill('#f5f0e8');

    doc.fontSize(8).font('Helvetica-Bold').fillColor(TAUPE)
      .text('NR', col.lot, tableY + 7, { width: 30 })
      .text('OPIS', col.desc, tableY + 7, { width: 215 })
      .text('CENA WYLIC.', col.hammer, tableY + 7, { width: 75, align: 'right' })
      .text('OPŁATA AUK.', col.premium, tableY + 7, { width: 70, align: 'right' })
      .text('RAZEM', col.total, tableY + 7, { width: 85, align: 'right' });

    // Table row
    const rowY = tableY + 28;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK)
      .text(String(invoice.lotNumber), col.lot, rowY, { width: 30 });

    const titleMaxLen = 55;
    const lotTitle = invoice.lotTitle.length > titleMaxLen
      ? invoice.lotTitle.slice(0, titleMaxLen) + '…'
      : invoice.lotTitle;

    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text(lotTitle, col.desc, rowY, { width: 215 });
    doc.fontSize(8).font('Helvetica').fillColor(TAUPE).text(invoice.auctionTitle, col.desc, doc.y + 1, { width: 215 });

    doc.fontSize(9).font('Helvetica').fillColor(DARK)
      .text(formatPLN(invoice.hammerPrice), col.hammer, rowY, { width: 75, align: 'right' })
      .text(formatPLN(invoice.buyersPremium), col.premium, rowY, { width: 70, align: 'right' })
      .text(formatPLN(invoice.totalAmount), col.total, rowY, { width: 85, align: 'right' });

    // Row separator
    const afterRow = rowY + 35;
    doc.moveTo(50, afterRow).lineTo(545, afterRow).lineWidth(0.5).strokeColor('#f0ebe0').stroke();

    // ── Totals block ─────────────────────────────────────────────────────────
    const totalsX = 365;
    let totY = afterRow + 16;

    const totalsRows: [string, number][] = [
      ['Cena wylicytowana', invoice.hammerPrice],
      ['Opłata aukcyjna', invoice.buyersPremium],
    ];

    for (const [label, amt] of totalsRows) {
      doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(label, totalsX, totY, { width: 105 });
      doc.text(formatPLN(amt), totalsX, totY, { width: 175, align: 'right' });
      totY += 16;
      doc.moveTo(totalsX, totY - 2).lineTo(540, totY - 2).lineWidth(0.3).strokeColor('#f0ebe0').stroke();
    }

    // Grand total line
    totY += 4;
    doc.moveTo(totalsX, totY).lineTo(540, totY).lineWidth(1.5).strokeColor(GOLD).stroke();
    totY += 6;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK)
      .text('DO ZAPŁATY', totalsX, totY, { width: 105 })
      .text(formatPLN(invoice.totalAmount), totalsX, totY, { width: 175, align: 'right' });

    // Amount in words
    totY += 20;
    doc.fontSize(8).font('Helvetica').fillColor(TAUPE)
      .text(`Słownie: ${amountInWords(invoice.totalAmount)}`, 50, totY, { width: W });

    // ── Payment info ─────────────────────────────────────────────────────────
    totY += 20;
    if (settings.company_bank_account) {
      doc.fontSize(8).font('Helvetica').fillColor(GRAY)
        .text(`Przelew na rachunek: ${settings.company_bank_account}`, 50, totY, { width: W });
      totY += 12;
    }

    // Paid date if applicable
    if (invoice.paidAt) {
      doc.fontSize(8).font('Helvetica').fillColor('#065f46')
        .text(`Opłacono: ${formatDate(invoice.paidAt)}`, 50, totY, { width: W });
      totY += 14;
    }

    // Notes
    if (invoice.notes) {
      totY += 4;
      doc.rect(50, totY, W, 1).fill('#e8e0d0');
      totY += 8;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(TAUPE).text('UWAGI', 50, totY);
      totY += 12;
      doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(invoice.notes, 50, totY, { width: W });
      totY += 30;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveTo(50, 770).lineTo(545, 770).lineWidth(0.5).strokeColor('#e8e0d0').stroke();
    const footerParts = [sellerName, ...(sellerNip ? [sellerNip] : [])];
    doc.fontSize(8).font('Helvetica').fillColor(TAUPE)
      .text(footerParts.join(' · '), 50, 776, { align: 'center', width: W });

    doc.end();
  });
}

// Format currency in PLN
function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Status label in Polish
function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Oczekująca',
    sent: 'Wysłana',
    paid: 'Opłacona',
    overdue: 'Przeterminowana',
    cancelled: 'Anulowana',
  };
  return labels[status] ?? status;
}

export function generateInvoiceHTML(invoice: InvoiceWithDetails): string {
  const buyerAddress = [
    invoice.userAddress,
    [invoice.userPostalCode, invoice.userCity].filter(Boolean).join(' '),
    invoice.userCountry,
  ]
    .filter(Boolean)
    .join('<br>');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Faktura ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 14px;
      color: #1a1a1a;
      background: #fff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 3px solid #c9a84c;
      margin-bottom: 32px;
    }
    .brand {
      display: flex;
      flex-direction: column;
    }
    .brand-name {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 4px;
      color: #1a1a1a;
    }
    .brand-tagline {
      font-size: 11px;
      letter-spacing: 2px;
      color: #8b7355;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-number {
      font-size: 18px;
      font-weight: bold;
      color: #c9a84c;
      letter-spacing: 1px;
    }
    .invoice-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      margin-bottom: 4px;
    }
    .invoice-date {
      font-size: 13px;
      color: #555;
      margin-top: 6px;
    }

    /* Parties */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 32px;
    }
    .party-block h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      border-bottom: 1px solid #e8e0d0;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .party-block p {
      font-size: 13px;
      line-height: 1.7;
      color: #333;
    }
    .party-name {
      font-weight: bold;
      font-size: 14px !important;
      color: #1a1a1a !important;
    }

    /* Lot table */
    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead tr {
      background: #f5f0e8;
    }
    th {
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8b7355;
      padding: 10px 12px;
      font-weight: normal;
    }
    th.right { text-align: right; }
    td {
      padding: 12px;
      font-size: 13px;
      color: #333;
      border-bottom: 1px solid #f0ebe0;
    }
    td.right { text-align: right; }
    .lot-title { font-weight: bold; color: #1a1a1a; }
    .lot-auction { font-size: 11px; color: #8b7355; margin-top: 2px; }

    /* Totals */
    .totals {
      margin-left: auto;
      width: 280px;
      margin-bottom: 32px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      font-size: 13px;
      color: #555;
      border-bottom: 1px solid #f0ebe0;
    }
    .totals-row.total {
      font-size: 16px;
      font-weight: bold;
      color: #1a1a1a;
      border-bottom: 2px solid #c9a84c;
      padding: 10px 0;
    }

    /* Status & due date */
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-sent    { background: #dbeafe; color: #1e40af; }
    .status-paid    { background: #d1fae5; color: #065f46; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }
    .due-date {
      font-size: 12px;
      color: #555;
    }
    .due-date strong { color: #1a1a1a; }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e8e0d0;
      font-size: 11px;
      color: #8b7355;
      text-align: center;
      line-height: 1.8;
    }

    /* Notes */
    .notes {
      background: #faf8f4;
      border: 1px solid #e8e0d0;
      border-radius: 4px;
      padding: 14px;
      font-size: 12px;
      color: #555;
      margin-bottom: 24px;
    }
    .notes-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8b7355;
      margin-bottom: 6px;
    }

    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">OMENAA</div>
      <div class="brand-tagline">Dom Aukcyjny</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-label">Faktura VAT</div>
      <div class="invoice-number">${invoice.invoiceNumber}</div>
      <div class="invoice-date">
        Data wystawienia: ${formatDate(invoice.createdAt)}<br>
        ${invoice.dueDate ? `Termin płatności: ${formatDate(invoice.dueDate)}` : ''}
      </div>
    </div>
  </div>

  <!-- Seller & Buyer -->
  <div class="parties">
    <div class="party-block">
      <h3>Sprzedawca</h3>
      <p>
        <span class="party-name">Omenaa Dom Aukcyjny Sp. z o.o.</span><br>
        ul. Przykładowa 1<br>
        00-001 Warszawa<br>
        NIP: 000-000-00-00
      </p>
    </div>
    <div class="party-block">
      <h3>Nabywca</h3>
      <p>
        <span class="party-name">${escapeHtml(invoice.userName)}</span><br>
        ${escapeHtml(invoice.userEmail)}<br>
        ${buyerAddress || ''}
      </p>
    </div>
  </div>

  <!-- Lot details -->
  <div class="section-title">Przedmiot aukcji</div>
  <table>
    <thead>
      <tr>
        <th>Nr lotu</th>
        <th>Opis</th>
        <th class="right">Cena wylicytowana</th>
        <th class="right">Opłata aukcyjna (20%)</th>
        <th class="right">Razem</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoice.lotNumber}</td>
        <td>
          <div class="lot-title">${escapeHtml(invoice.lotTitle)}</div>
          <div class="lot-auction">${escapeHtml(invoice.auctionTitle)}</div>
        </td>
        <td class="right">${formatPLN(invoice.hammerPrice)}</td>
        <td class="right">${formatPLN(invoice.buyersPremium)}</td>
        <td class="right">${formatPLN(invoice.totalAmount)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row">
      <span>Cena wylicytowana</span>
      <span>${formatPLN(invoice.hammerPrice)}</span>
    </div>
    <div class="totals-row">
      <span>Opłata aukcyjna (20%)</span>
      <span>${formatPLN(invoice.buyersPremium)}</span>
    </div>
    <div class="totals-row total">
      <span>Do zapłaty</span>
      <span>${formatPLN(invoice.totalAmount)}</span>
    </div>
  </div>

  <!-- Status & due date -->
  <div class="status-row">
    <div>
      <span class="status-badge status-${invoice.status}">
        ${statusLabel(invoice.status)}
      </span>
      ${invoice.paidAt ? `<span style="font-size:12px;color:#555;margin-left:10px;">Opłacono: ${formatDate(invoice.paidAt)}</span>` : ''}
    </div>
    ${invoice.dueDate ? `
    <div class="due-date">
      Termin płatności: <strong>${formatDate(invoice.dueDate)}</strong>
    </div>` : ''}
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-label">Uwagi</div>
    ${escapeHtml(invoice.notes)}
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    Omenaa Dom Aukcyjny · ul. Przykładowa 1, 00-001 Warszawa<br>
    NIP: 000-000-00-00 · KRS: 0000000000<br>
    Płatność przelewem na rachunek: 00 0000 0000 0000 0000 0000 0000
  </div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
