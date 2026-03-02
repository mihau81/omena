import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { invoices, users, lots, auctions, payments } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Quote if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatAmount(amount: number): string {
  // Polish decimal format: use comma as separator, no thousands separator
  return (amount / 100 * 100).toFixed(2).replace('.', ',');
}

export async function GET(request: Request) {
  try {
    await requireAdmin('invoices:manage');

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status');

    // Build conditions
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(invoices.status, status));
    }
    if (dateFrom) {
      conditions.push(gte(invoices.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      // Include the full end day
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(invoices.createdAt, end));
    }

    const query = db
      .select({
        invoiceNumber: invoices.invoiceNumber,
        createdAt: invoices.createdAt,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        status: invoices.status,
        hammerPrice: invoices.hammerPrice,
        buyersPremium: invoices.buyersPremium,
        totalAmount: invoices.totalAmount,
        currency: invoices.currency,
        userName: users.name,
        userEmail: users.email,
        lotTitle: lots.title,
        lotNumber: lots.lotNumber,
        auctionTitle: auctions.title,
      })
      .from(invoices)
      .innerJoin(users, eq(invoices.userId, users.id))
      .innerJoin(lots, eq(invoices.lotId, lots.id))
      .innerJoin(auctions, eq(invoices.auctionId, auctions.id))
      .orderBy(desc(invoices.createdAt))
      .limit(10000);

    const rows = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Get latest payment status per invoice
    const invoiceNumbers = rows.map((r) => r.invoiceNumber);
    const paymentRows = invoiceNumbers.length > 0
      ? await db
          .select({
            invoiceId: payments.invoiceId,
            status: payments.status,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .orderBy(desc(payments.createdAt))
      : [];

    // Build payment map (latest payment per invoice)
    const paymentMap: Record<string, string> = {};
    // We need invoice IDs — fetch them separately
    const invoiceIdRows = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(10000);

    const numToId: Record<string, string> = {};
    for (const r of invoiceIdRows) {
      numToId[r.invoiceNumber] = r.id;
    }

    for (const p of paymentRows) {
      if (!paymentMap[p.invoiceId]) {
        paymentMap[p.invoiceId] = p.status;
      }
    }

    // CSV headers (Polish accounting format)
    const HEADERS = [
      'Numer faktury',
      'Data wystawienia',
      'Termin płatności',
      'NIP nabywcy',
      'Nazwa nabywcy',
      'Email nabywcy',
      'Tytuł lotu',
      'Nr lotu',
      'Aukcja',
      'Cena wylicytowana (PLN)',
      'Opłata aukcyjna (PLN)',
      'Kwota netto (PLN)',
      'Stawka VAT',
      'Kwota VAT (PLN)',
      'Kwota brutto (PLN)',
      'Status faktury',
      'Status płatności',
      'Data płatności',
      'Waluta',
    ];

    const csvLines: string[] = [HEADERS.join(',')];

    for (const row of rows) {
      const invoiceId = numToId[row.invoiceNumber];
      const paymentStatus = invoiceId ? (paymentMap[invoiceId] ?? '') : '';

      // Polish VAT rules: artwork sales are VAT-exempt (zw), buyer's premium 23%
      // Simplified: show total as gross, premium as VAT base at 23%
      const premiumNet = Math.round(row.buyersPremium / 1.23 * 100) / 100;
      const vatAmount = row.buyersPremium - premiumNet;
      // Hammer price is VAT-exempt, so net = hammerPrice + premiumNet, VAT only on premium
      const netAmount = row.hammerPrice + premiumNet;

      const cells = [
        csvEscape(row.invoiceNumber),
        csvEscape(formatDate(row.createdAt)),
        csvEscape(formatDate(row.dueDate)),
        csvEscape(''),  // NIP nabywcy — not stored for individual buyers
        csvEscape(row.userName),
        csvEscape(row.userEmail),
        csvEscape(row.lotTitle),
        csvEscape(row.lotNumber),
        csvEscape(row.auctionTitle),
        csvEscape(formatAmount(row.hammerPrice)),
        csvEscape(formatAmount(row.buyersPremium)),
        csvEscape(formatAmount(netAmount)),
        csvEscape('23%'),
        csvEscape(formatAmount(vatAmount)),
        csvEscape(formatAmount(row.totalAmount)),
        csvEscape(row.status),
        csvEscape(paymentStatus),
        csvEscape(formatDate(row.paidAt)),
        csvEscape(row.currency),
      ];

      csvLines.push(cells.join(','));
    }

    const csv = csvLines.join('\r\n');
    const now = new Date().toISOString().slice(0, 10);
    const filename = `faktury-${now}.csv`;

    return new Response('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Invoice export error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
