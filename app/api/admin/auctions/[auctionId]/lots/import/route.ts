import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { parseLotCSV, importLots } from '@/lib/lot-import';

// ─── POST: Parse CSV and optionally import lots ──────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  try {
    const admin = await requireAdmin('lots:write');
    const { auctionId } = await params;

    // Verify auction exists
    const [auction] = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Request must be multipart/form-data' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded. Use field name "file".' }, { status: 400 });
    }

    // Validate file type
    const filename = file instanceof File ? file.name : 'upload.csv';
    if (!filename.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are accepted (.csv extension required)' }, { status: 400 });
    }

    // Read CSV content
    const csvContent = await file.text();
    if (!csvContent.trim()) {
      return NextResponse.json({ error: 'The uploaded file is empty' }, { status: 400 });
    }

    // Parse the CSV
    const parseResult = parseLotCSV(csvContent);

    // Check for ?confirm=true to actually import
    const url = new URL(request.url);
    const confirm = url.searchParams.get('confirm') === 'true';

    if (!confirm) {
      // Preview mode: return parsed data without importing
      return NextResponse.json({
        valid: parseResult.rows,
        errors: parseResult.errors,
        totalRows: parseResult.totalRows,
        validCount: parseResult.rows.length,
        errorCount: parseResult.errors.filter((e) => e.rowIndex > 0).length,
      });
    }

    // Import mode
    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid rows to import',
          errors: parseResult.errors,
          totalRows: parseResult.totalRows,
        },
        { status: 422 },
      );
    }

    const importResult = await importLots(auctionId, parseResult.rows, admin.id);

    return NextResponse.json(
      {
        imported: importResult.imported,
        skipped: importResult.skipped,
        importErrors: importResult.errors,
        totalRows: parseResult.totalRows,
        parseErrors: parseResult.errors,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Lot CSV import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
