import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogLot {
  lotNumber: number;
  title: string;
  artist: string;
  medium: string;
  dimensions: string;
  year: number | null;
  description: string;
  estimateMin: number;
  estimateMax: number;
  provenance: string[];
  primaryImageUrl: string | null;
}

export interface CatalogAuction {
  title: string;
  date: string;       // formatted date string
  location: string;
  curator: string;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD = '#c9a84c';
const DARK = '#1a1a1a';
const TAUPE = '#8b7355';
const LIGHT_GRAY = '#f5f3ef';
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(n);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { timeout: 8000 }, (res) => {
        if (res.statusCode !== 200) { resolve(null); return; }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function drawCoverPage(doc: InstanceType<typeof PDFDocument>, auction: CatalogAuction) {
  // Full-page dark background
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);

  // Gold accent bar top
  doc.rect(0, 0, PAGE_W, 6).fill(GOLD);

  // OMENA logotype
  doc.font('Helvetica-Bold').fontSize(48).fillColor(GOLD)
    .text('OMENA', MARGIN, 120, { width: CONTENT_W, align: 'center' });

  doc.font('Helvetica').fontSize(11).fillColor('#aaaaaa');
  doc.text('DOM AUKCYJNY', MARGIN, 180, { width: CONTENT_W, align: 'center', characterSpacing: 4 });

  // Separator line
  const lineY = 220;
  doc.moveTo(MARGIN + 80, lineY).lineTo(PAGE_W - MARGIN - 80, lineY).lineWidth(1).strokeColor(GOLD).stroke();

  // Auction title
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#ffffff')
    .text(auction.title, MARGIN, 250, { width: CONTENT_W, align: 'center' });

  // Meta info
  doc.font('Helvetica').fontSize(12).fillColor('#cccccc')
    .text(auction.date, MARGIN, 320, { width: CONTENT_W, align: 'center' });

  if (auction.location) {
    doc.text(auction.location, MARGIN, 340, { width: CONTENT_W, align: 'center' });
  }
  if (auction.curator) {
    doc.font('Helvetica').fontSize(11).fillColor(GOLD)
      .text(`Kurator: ${auction.curator}`, MARGIN, 380, { width: CONTENT_W, align: 'center' });
  }

  // Description (truncated)
  if (auction.description) {
    const desc = auction.description.length > 400
      ? auction.description.slice(0, 400) + '…'
      : auction.description;
    doc.font('Helvetica').fontSize(10).fillColor('#999999')
      .text(desc, MARGIN + 40, 430, { width: CONTENT_W - 80, align: 'center', lineGap: 4 });
  }

  // Gold accent bar bottom
  doc.rect(0, PAGE_H - 6, PAGE_W, 6).fill(GOLD);

  // Footer text
  doc.font('Helvetica').fontSize(8).fillColor('#666666')
    .text('www.omena.pl · info@omena.pl', MARGIN, PAGE_H - 30, { width: CONTENT_W, align: 'center' });
}

// ─── Table of Contents ────────────────────────────────────────────────────────

function drawTOCPage(doc: InstanceType<typeof PDFDocument>, lots: CatalogLot[]) {
  // Header
  doc.font('Helvetica-Bold').fontSize(22).fillColor(DARK)
    .text('Spis Treści', MARGIN, MARGIN, { width: CONTENT_W });

  doc.moveTo(MARGIN, MARGIN + 32).lineTo(PAGE_W - MARGIN, MARGIN + 32)
    .lineWidth(2).strokeColor(GOLD).stroke();

  let y = MARGIN + 50;
  const lineH = 22;
  const maxPerPage = Math.floor((PAGE_H - MARGIN * 2 - 80) / lineH);
  let count = 0;

  for (const lot of lots) {
    if (count > 0 && count % maxPerPage === 0) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(22).fillColor(DARK)
        .text('Spis Treści (cd.)', MARGIN, MARGIN, { width: CONTENT_W });
      doc.moveTo(MARGIN, MARGIN + 32).lineTo(PAGE_W - MARGIN, MARGIN + 32)
        .lineWidth(2).strokeColor(GOLD).stroke();
      y = MARGIN + 50;
    }

    // Zebra striping
    if (count % 2 === 0) {
      doc.rect(MARGIN - 4, y - 3, CONTENT_W + 8, lineH - 2).fill(LIGHT_GRAY);
    }

    // Lot number
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GOLD)
      .text(`${lot.lotNumber}.`, MARGIN, y, { width: 30 });

    // Title + artist
    const label = lot.artist ? `${lot.artist}, ${lot.title}` : lot.title;
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(label, MARGIN + 36, y, { width: CONTENT_W - 100, lineBreak: false });

    // Estimate
    const est = `${fmt(lot.estimateMin)} – ${fmt(lot.estimateMax)}`;
    doc.font('Helvetica').fontSize(9).fillColor(TAUPE)
      .text(est, MARGIN + CONTENT_W - 60, y, { width: 60, align: 'right' });

    y += lineH;
    count++;
  }
}

// ─── Lot Page ─────────────────────────────────────────────────────────────────

async function drawLotPage(
  doc: InstanceType<typeof PDFDocument>,
  lot: CatalogLot,
) {
  // Lot number badge
  doc.rect(MARGIN, MARGIN, 44, 24).fill(GOLD);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff')
    .text(`${lot.lotNumber}`, MARGIN, MARGIN + 6, { width: 44, align: 'center' });

  // Title
  doc.font('Helvetica-Bold').fontSize(18).fillColor(DARK)
    .text(lot.title, MARGIN + 54, MARGIN, { width: CONTENT_W - 54 });

  // Artist
  if (lot.artist) {
    doc.font('Helvetica').fontSize(13).fillColor(TAUPE)
      .text(lot.artist, MARGIN + 54, MARGIN + 24, { width: CONTENT_W - 54 });
  }

  // Separator
  doc.moveTo(MARGIN, MARGIN + 52).lineTo(PAGE_W - MARGIN, MARGIN + 52)
    .lineWidth(1).strokeColor('#e8e0d0').stroke();

  let contentY = MARGIN + 68;

  // Image (left column)
  const imgW = 230;
  const imgH = 280;
  let imageDrawn = false;

  if (lot.primaryImageUrl) {
    const imgBuf = await fetchImageBuffer(lot.primaryImageUrl);
    if (imgBuf) {
      try {
        doc.image(imgBuf, MARGIN, contentY, { width: imgW, height: imgH, fit: [imgW, imgH], align: 'center', valign: 'center' });
        imageDrawn = true;
      } catch {
        // Image failed to embed — skip gracefully
      }
    }
  }

  if (!imageDrawn) {
    // Placeholder box
    doc.rect(MARGIN, contentY, imgW, imgH).lineWidth(1).strokeColor('#e8e0d0').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#cccccc')
      .text('Brak zdjęcia', MARGIN, contentY + imgH / 2 - 6, { width: imgW, align: 'center' });
  }

  // Details (right column)
  const detailX = MARGIN + imgW + 20;
  const detailW = CONTENT_W - imgW - 20;
  let dy = contentY;

  function detail(label: string, value: string) {
    if (!value) return;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(TAUPE)
      .text(label.toUpperCase(), detailX, dy, { width: detailW });
    dy += 12;
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(value, detailX, dy, { width: detailW, lineGap: 2 });
    dy += doc.heightOfString(value, { width: detailW }) + 10;
  }

  if (lot.medium) detail('Technika', lot.medium);
  if (lot.dimensions) detail('Wymiary', lot.dimensions);
  if (lot.year) detail('Rok', String(lot.year));

  // Estimate box
  dy += 4;
  doc.rect(detailX, dy, detailW, 48).fill(LIGHT_GRAY);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TAUPE)
    .text('ESTYMACJA', detailX + 8, dy + 6, { width: detailW - 16 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(GOLD)
    .text(`${fmt(lot.estimateMin)} – ${fmt(lot.estimateMax)}`, detailX + 8, dy + 20, { width: detailW - 16 });
  dy += 60;

  // Description (below image)
  const descY = contentY + imgH + 20;
  if (lot.description) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(TAUPE)
      .text('OPIS', MARGIN, descY);
    const desc = lot.description.length > 600 ? lot.description.slice(0, 600) + '…' : lot.description;
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(desc, MARGIN, descY + 14, { width: CONTENT_W, lineGap: 3 });
  }

  // Provenance (if present)
  if (lot.provenance && lot.provenance.length > 0) {
    const provY = descY + (lot.description ? doc.heightOfString(lot.description.slice(0, 600), { width: CONTENT_W }) + 30 : 0);
    if (provY < PAGE_H - MARGIN - 60) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TAUPE)
        .text('PROWENIENCJA', MARGIN, provY + 14);
      const provText = lot.provenance.join(' · ');
      doc.font('Helvetica').fontSize(9).fillColor(DARK)
        .text(provText, MARGIN, provY + 28, { width: CONTENT_W, lineGap: 2 });
    }
  }

  // Page footer
  doc.moveTo(MARGIN, PAGE_H - MARGIN - 12).lineTo(PAGE_W - MARGIN, PAGE_H - MARGIN - 12)
    .lineWidth(0.5).strokeColor('#e8e0d0').stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa')
    .text('Omena Dom Aukcyjny · www.omena.pl', MARGIN, PAGE_H - MARGIN + 2, { width: CONTENT_W });
  doc.font('Helvetica').fontSize(8).fillColor(GOLD)
    .text(`LOT ${lot.lotNumber}`, MARGIN, PAGE_H - MARGIN + 2, { width: CONTENT_W, align: 'right' });
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateCatalogPdf(
  auction: CatalogAuction,
  lots: CatalogLot[],
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      info: {
        Title: `Katalog: ${auction.title}`,
        Author: 'Omena Dom Aukcyjny',
        Subject: 'Katalog aukcyjny',
      },
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // Cover page
      doc.addPage();
      drawCoverPage(doc, auction);

      // Table of contents
      if (lots.length > 0) {
        doc.addPage();
        drawTOCPage(doc, lots);
      }

      // One page per lot
      for (const lot of lots) {
        doc.addPage();
        await drawLotPage(doc, lot);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
