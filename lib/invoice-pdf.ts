import type { InvoiceWithDetails } from './invoice-service';

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
      <div class="brand-name">OMENA</div>
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
        <span class="party-name">Omena Dom Aukcyjny Sp. z o.o.</span><br>
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
    Omena Dom Aukcyjny · ul. Przykładowa 1, 00-001 Warszawa<br>
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
