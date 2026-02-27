import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { listInvoices } from '@/lib/invoice-service';
import { db } from '@/db/connection';
import { payments } from '@/db/schema';

// ─── GET: List invoices with optional filters ───────────────────────────────

export async function GET(request: Request) {
  try {
    await requireAdmin('invoices:manage');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const auctionId = searchParams.get('auctionId') ?? undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '100', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const data = await listInvoices({ status, auctionId, userId, limit, offset });

    // Enrich with latest payment status for each invoice
    const invoiceIds = data.map((i) => i.id);
    let paymentMap: Record<string, { status: string; provider: string; externalId: string | null }> = {};

    if (invoiceIds.length > 0) {
      const rows = await db
        .select({
          invoiceId: payments.invoiceId,
          status: payments.status,
          provider: payments.provider,
          externalId: payments.externalId,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(inArray(payments.invoiceId, invoiceIds));

      // Keep only the latest payment per invoice
      for (const row of rows) {
        const existing = paymentMap[row.invoiceId];
        if (!existing || row.createdAt > new Date(existing as unknown as string)) {
          paymentMap[row.invoiceId] = {
            status: row.status,
            provider: row.provider,
            externalId: row.externalId,
          };
        }
      }
    }

    const enriched = data.map((inv) => ({
      ...inv,
      payment: paymentMap[inv.id] ?? null,
    }));

    return NextResponse.json({ invoices: enriched });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin invoices GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
