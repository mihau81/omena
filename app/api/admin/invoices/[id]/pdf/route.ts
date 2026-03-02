import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getInvoice } from '@/lib/invoice-service';
import { generateInvoicePdf, type CompanySettings } from '@/lib/invoice-pdf';
import { db } from '@/db/connection';
import { settings } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { getFromS3, uploadToS3 } from '@/lib/s3';

const COMPANY_KEYS = [
  'company_name',
  'company_address',
  'company_city',
  'company_postal_code',
  'company_country',
  'company_nip',
  'company_bank_account',
] as const;

async function loadCompanySettings(): Promise<CompanySettings> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, [...COMPANY_KEYS]));

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value ?? '';
  }

  return {
    company_name: map['company_name'] ?? 'Omena Dom Aukcyjny',
    company_address: map['company_address'] ?? '',
    company_city: map['company_city'] ?? '',
    company_postal_code: map['company_postal_code'] ?? '',
    company_country: map['company_country'] ?? 'Poland',
    company_nip: map['company_nip'] ?? '',
    company_bank_account: map['company_bank_account'] ?? undefined,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('invoices:manage');
    const { id } = await params;

    const invoice = await getInvoice(id);
    if (!invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const filename = `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
    // Cache key includes updatedAt so re-generated PDFs replace old ones when status changes
    const updatedEpoch = new Date(invoice.updatedAt).getTime();
    const s3Key = `invoices/${id}/${updatedEpoch}.pdf`;

    // Try S3 cache first
    let pdfBuffer = await getFromS3(s3Key).catch(() => null);

    if (!pdfBuffer) {
      const companySettings = await loadCompanySettings();
      pdfBuffer = await generateInvoicePdf(invoice, companySettings);
      // Store in S3 for future requests (fire-and-forget, don't fail if S3 is unavailable)
      uploadToS3(s3Key, pdfBuffer, 'application/pdf').catch((err) =>
        console.warn('[invoice-pdf] S3 cache upload failed:', err),
      );
    }

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Admin invoice PDF error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
