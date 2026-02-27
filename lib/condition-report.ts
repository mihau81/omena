// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConditionReportLot {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  medium: string;
  dimensions: string;
  year: number | null;
  estimateMin: number;
  estimateMax: number;
  conditionNotes: string | null;
  provenance: string[] | unknown;
  description: string;
}

export interface ConditionReportAuction {
  id: string;
  title: string;
  startDate: Date | string;
}

export interface ConditionReportMedia {
  url: string;
  largeUrl: string | null;
  mediumUrl: string | null;
  altText: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const SHARED_CSS = `
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
    .doc-meta {
      text-align: right;
    }
    .doc-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 16px;
      font-weight: bold;
      color: #c9a84c;
      letter-spacing: 1px;
    }
    .doc-date {
      font-size: 12px;
      color: #555;
      margin-top: 6px;
    }

    /* Auction info bar */
    .auction-bar {
      background: #f5f0e8;
      border: 1px solid #e8e0d0;
      border-radius: 4px;
      padding: 14px 18px;
      margin-bottom: 28px;
    }
    .auction-bar-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      margin-bottom: 4px;
    }
    .auction-bar-title {
      font-size: 16px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .auction-bar-date {
      font-size: 12px;
      color: #555;
      margin-top: 3px;
    }

    /* Lot header */
    .lot-header {
      margin-bottom: 24px;
    }
    .lot-number {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      margin-bottom: 6px;
    }
    .lot-title {
      font-size: 22px;
      font-weight: bold;
      color: #1a1a1a;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .lot-artist {
      font-size: 15px;
      color: #555;
      font-style: italic;
      margin-bottom: 16px;
    }
    .lot-attributes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 40px;
      border-top: 1px solid #e8e0d0;
      padding-top: 16px;
    }
    .attribute {
      display: flex;
      flex-direction: column;
    }
    .attribute-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #8b7355;
      margin-bottom: 3px;
    }
    .attribute-value {
      font-size: 13px;
      color: #1a1a1a;
    }

    /* Image */
    .image-section {
      margin: 28px 0;
      text-align: center;
    }
    .lot-image {
      max-width: 100%;
      max-height: 440px;
      object-fit: contain;
      border: 1px solid #e8e0d0;
      border-radius: 4px;
    }
    .image-caption {
      font-size: 11px;
      color: #8b7355;
      margin-top: 8px;
      font-style: italic;
    }

    /* Sections */
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      border-bottom: 1px solid #e8e0d0;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .section-content {
      font-size: 13px;
      line-height: 1.8;
      color: #333;
    }
    .section-empty {
      font-size: 13px;
      color: #aaa;
      font-style: italic;
    }

    /* Provenance list */
    .provenance-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .provenance-list li {
      font-size: 13px;
      color: #333;
      line-height: 1.7;
      padding-left: 16px;
      position: relative;
    }
    .provenance-list li::before {
      content: '·';
      position: absolute;
      left: 0;
      color: #c9a84c;
      font-weight: bold;
    }

    /* Estimate */
    .estimate-section {
      background: #faf8f4;
      border: 1px solid #e8e0d0;
      border-radius: 4px;
      padding: 16px 18px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .estimate-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8b7355;
      margin-bottom: 4px;
    }
    .estimate-value {
      font-size: 18px;
      font-weight: bold;
      color: #1a1a1a;
    }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e8e0d0;
      font-size: 11px;
      color: #8b7355;
      text-align: center;
      line-height: 1.9;
    }
    .footer-disclaimer {
      margin-top: 8px;
      font-size: 10px;
      color: #aaa;
      font-style: italic;
    }

    /* Page break for batch reports */
    .page-break {
      page-break-before: always;
    }

    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
`;

// ─── Single report body (reusable for batch) ─────────────────────────────────

function renderReportBody(
  lot: ConditionReportLot,
  auction: ConditionReportAuction,
  primaryMedia: ConditionReportMedia | null,
  opts: { includeAuctionHeader?: boolean } = {},
): string {
  const { includeAuctionHeader = true } = opts;

  const provenance = toStringArray(lot.provenance);
  const imageUrl = primaryMedia?.largeUrl ?? primaryMedia?.mediumUrl ?? primaryMedia?.url ?? null;

  const auctionBlock = includeAuctionHeader
    ? `
  <!-- Auction info -->
  <div class="auction-bar">
    <div class="auction-bar-label">Aukcja</div>
    <div class="auction-bar-title">${escapeHtml(auction.title)}</div>
    <div class="auction-bar-date">Data: ${formatDate(auction.startDate)}</div>
  </div>`
    : '';

  const imageBlock = imageUrl
    ? `
  <!-- Primary image -->
  <div class="image-section">
    <img
      class="lot-image"
      src="${escapeHtml(imageUrl)}"
      alt="${escapeHtml(lot.title)}"
    />
    <div class="image-caption">${escapeHtml(lot.title)}${lot.artist ? ` — ${escapeHtml(lot.artist)}` : ''}</div>
  </div>`
    : '';

  const conditionBlock = lot.conditionNotes?.trim()
    ? `<div class="section-content">${escapeHtml(lot.conditionNotes.trim())}</div>`
    : `<div class="section-empty">Brak uwag dotyczących stanu zachowania.</div>`;

  const provenanceBlock =
    provenance.length > 0
      ? `<ul class="provenance-list">${provenance.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
      : `<div class="section-empty">Proweniencja nieznana.</div>`;

  const yearLabel = lot.year ? String(lot.year) : '—';
  const mediumLabel = lot.medium || '—';
  const dimensionsLabel = lot.dimensions || '—';

  return `
  ${auctionBlock}

  <!-- Lot header -->
  <div class="lot-header">
    <div class="lot-number">Lot ${lot.lotNumber}</div>
    <div class="lot-title">${escapeHtml(lot.title)}</div>
    ${lot.artist ? `<div class="lot-artist">${escapeHtml(lot.artist)}</div>` : ''}

    <div class="lot-attributes">
      <div class="attribute">
        <span class="attribute-label">Technika</span>
        <span class="attribute-value">${escapeHtml(mediumLabel)}</span>
      </div>
      <div class="attribute">
        <span class="attribute-label">Wymiary</span>
        <span class="attribute-value">${escapeHtml(dimensionsLabel)}</span>
      </div>
      <div class="attribute">
        <span class="attribute-label">Rok</span>
        <span class="attribute-value">${yearLabel}</span>
      </div>
      <div class="attribute">
        <span class="attribute-label">Nr katalogowy</span>
        <span class="attribute-value">${lot.lotNumber}</span>
      </div>
    </div>
  </div>

  ${imageBlock}

  <!-- Condition notes -->
  <div class="section">
    <div class="section-title">Stan zachowania</div>
    ${conditionBlock}
  </div>

  <!-- Provenance -->
  <div class="section">
    <div class="section-title">Proweniencja</div>
    ${provenanceBlock}
  </div>

  <!-- Estimate -->
  <div class="estimate-section">
    <div>
      <div class="estimate-label">Estymata</div>
      <div class="estimate-value">
        ${formatPLN(lot.estimateMin)} &ndash; ${formatPLN(lot.estimateMax)}
      </div>
    </div>
  </div>`;
}

// ─── Single condition report ──────────────────────────────────────────────────

export function generateConditionReportHTML(
  lot: ConditionReportLot,
  auction: ConditionReportAuction,
  primaryMedia: ConditionReportMedia | null,
): string {
  const safeFilename = `${lot.lotNumber}-${lot.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-condition-report`;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raport Stanu — Lot ${lot.lotNumber}: ${escapeHtml(lot.title)}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">OMENA</div>
      <div class="brand-tagline">Dom Aukcyjny</div>
    </div>
    <div class="doc-meta">
      <div class="doc-label">Raport Stanu / Condition Report</div>
      <div class="doc-title">Lot ${lot.lotNumber}</div>
      <div class="doc-date">Wygenerowano: ${formatDate(new Date())}</div>
    </div>
  </div>

  ${renderReportBody(lot, auction, primaryMedia)}

  <!-- Footer -->
  <div class="footer">
    Omena Dom Aukcyjny &middot; ul. Przykładowa 1, 00-001 Warszawa<br>
    NIP: 000-000-00-00 &middot; KRS: 0000000000<br>
    Raport przygotowany przez Omena Dom Aukcyjny na podstawie bezpośredniej analizy obiektu.
    <div class="footer-disclaimer">
      Niniejszy raport ma charakter wyłącznie informacyjny. Omena Dom Aukcyjny nie ponosi odpowiedzialności
      za rozbieżności pomiędzy opisem a stanem faktycznym obiektu ustalanym po jego odbiorze przez nabywcę.
      Wszelkie uwagi dotyczące stanu zachowania należy zgłosić przed przystąpieniem do licytacji.
    </div>
  </div>

  <!-- Hidden filename hint for download -->
  <span style="display:none" data-filename="${escapeHtml(safeFilename)}.html"></span>

</body>
</html>`;
}

// ─── Batch condition report (all lots in auction) ────────────────────────────

export interface BatchConditionReportItem {
  lot: ConditionReportLot;
  primaryMedia: ConditionReportMedia | null;
}

export function generateBatchConditionReportHTML(
  auction: ConditionReportAuction,
  items: BatchConditionReportItem[],
): string {
  if (items.length === 0) {
    return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Raporty Stanu — ${escapeHtml(auction.title)}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-name">OMENA</div>
      <div class="brand-tagline">Dom Aukcyjny</div>
    </div>
    <div class="doc-meta">
      <div class="doc-label">Raporty Stanu / Condition Reports</div>
      <div class="doc-title">${escapeHtml(auction.title)}</div>
      <div class="doc-date">Wygenerowano: ${formatDate(new Date())}</div>
    </div>
  </div>
  <p style="color:#aaa;font-style:italic;margin-top:40px;text-align:center;">Brak lotów w tej aukcji.</p>
</body>
</html>`;
  }

  const pages = items
    .map((item, idx) => {
      const pageBreak = idx > 0 ? '<div class="page-break"></div>' : '';
      return `
  ${pageBreak}
  <!-- ── Lot ${item.lot.lotNumber} ── -->
  <div class="report-page">
    <!-- Per-page header -->
    <div class="header">
      <div class="brand">
        <div class="brand-name">OMENA</div>
        <div class="brand-tagline">Dom Aukcyjny</div>
      </div>
      <div class="doc-meta">
        <div class="doc-label">Raport Stanu / Condition Report</div>
        <div class="doc-title">Lot ${item.lot.lotNumber}</div>
        <div class="doc-date">Wygenerowano: ${formatDate(new Date())}</div>
      </div>
    </div>

    ${renderReportBody(item.lot, auction, item.primaryMedia)}

    <!-- Footer -->
    <div class="footer">
      Omena Dom Aukcyjny &middot; ul. Przykładowa 1, 00-001 Warszawa<br>
      NIP: 000-000-00-00 &middot; KRS: 0000000000<br>
      Raport przygotowany przez Omena Dom Aukcyjny na podstawie bezpośredniej analizy obiektu.
      <div class="footer-disclaimer">
        Niniejszy raport ma charakter wyłącznie informacyjny. Omena Dom Aukcyjny nie ponosi
        odpowiedzialności za rozbieżności pomiędzy opisem a stanem faktycznym obiektu. Wszelkie
        uwagi dotyczące stanu zachowania należy zgłosić przed przystąpieniem do licytacji.
      </div>
    </div>
  </div>`;
    })
    .join('\n');

  const slug = auction.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raporty Stanu — ${escapeHtml(auction.title)}</title>
  <style>
    ${SHARED_CSS}
    .report-page { page-break-inside: avoid; }
  </style>
</head>
<body>

  <!-- Cover page -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">OMENA</div>
      <div class="brand-tagline">Dom Aukcyjny</div>
    </div>
    <div class="doc-meta">
      <div class="doc-label">Raporty Stanu / Condition Reports</div>
      <div class="doc-title">${escapeHtml(auction.title)}</div>
      <div class="doc-date">Data aukcji: ${formatDate(auction.startDate)}<br>Wygenerowano: ${formatDate(new Date())}</div>
    </div>
  </div>

  <div style="margin-bottom:32px;font-size:13px;color:#555;line-height:1.7;">
    Niniejszy dokument zawiera raporty stanu zachowania wszystkich ${items.length} lot&oacute;w
    aukcji <strong>${escapeHtml(auction.title)}</strong>.
  </div>

  <!-- Hidden filename hint -->
  <span style="display:none" data-filename="${escapeHtml(slug)}-condition-reports.html"></span>

  ${pages}

</body>
</html>`;
}
