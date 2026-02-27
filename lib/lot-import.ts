import { parse } from 'csv-parse/sync';
import { db } from '@/db/connection';
import { lots } from '@/db/schema';
import { eq, isNull, and, max } from 'drizzle-orm';
import { logCreate } from '@/lib/audit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedLot {
  rowIndex: number;           // 1-based row number (excluding header)
  lotNumber: number;
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: number | null;
  estimateMin: number;
  estimateMax: number;
  reservePrice: number | null;
  startingBid: number | null;
  provenance: string[];
  exhibitions: string[];
}

export interface ImportError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedLot[];
  errors: ImportError[];
  totalRows: number;
}

// ─── CSV Column Names ────────────────────────────────────────────────────────

const REQUIRED_HEADERS = [
  'lot_number',
  'title',
] as const;

const ALL_HEADERS = [
  'lot_number',
  'title',
  'artist',
  'description',
  'medium',
  'dimensions',
  'year',
  'estimate_min',
  'estimate_max',
  'reserve_price',
  'starting_bid',
  'provenance',
  'exhibitions',
] as const;

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseIntOrNull(value: string | undefined, fieldName: string, rowIndex: number, errors: ImportError[]): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = parseInt(value.trim(), 10);
  if (isNaN(parsed) || parsed < 0) {
    errors.push({ rowIndex, field: fieldName, message: `Must be a non-negative integer, got: "${value}"` });
    return null;
  }
  return parsed;
}

function parseIntRequired(value: string | undefined, fieldName: string, rowIndex: number, errors: ImportError[]): number {
  if (!value || value.trim() === '') {
    errors.push({ rowIndex, field: fieldName, message: 'This field is required and must be a non-negative integer' });
    return 0;
  }
  const parsed = parseInt(value.trim(), 10);
  if (isNaN(parsed) || parsed < 0) {
    errors.push({ rowIndex, field: fieldName, message: `Must be a non-negative integer, got: "${value}"` });
    return 0;
  }
  return parsed;
}

function parseSemicolonList(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseLotCSV(csvContent: string): ParseResult {
  const errors: ImportError[] = [];
  const rows: ParsedLot[] = [];

  // Parse raw CSV
  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,           // Handle UTF-8 BOM
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown CSV parse error';
    errors.push({ rowIndex: 0, field: 'file', message: `CSV parse failed: ${message}` });
    return { rows: [], errors, totalRows: 0 };
  }

  if (rawRows.length === 0) {
    errors.push({ rowIndex: 0, field: 'file', message: 'CSV file is empty or has no data rows' });
    return { rows: [], errors, totalRows: 0 };
  }

  // Validate headers
  const firstRow = rawRows[0];
  const presentColumns = Object.keys(firstRow).map((k) => k.toLowerCase().trim());

  // Check for unknown columns (warn via error with rowIndex 0)
  const unknownCols = presentColumns.filter((c) => !(ALL_HEADERS as readonly string[]).includes(c));
  if (unknownCols.length > 0) {
    errors.push({
      rowIndex: 0,
      field: 'headers',
      message: `Unknown columns will be ignored: ${unknownCols.join(', ')}`,
    });
  }

  // Check required headers exist
  for (const required of REQUIRED_HEADERS) {
    if (!presentColumns.includes(required)) {
      errors.push({
        rowIndex: 0,
        field: 'headers',
        message: `Missing required column: "${required}"`,
      });
    }
  }

  // If missing required headers, abort row processing
  const headerErrors = errors.filter((e) => e.rowIndex === 0 && e.field === 'headers' && e.message.startsWith('Missing'));
  if (headerErrors.length > 0) {
    return { rows: [], errors, totalRows: 0 };
  }

  // Process each row
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowIndex = i + 1;
    const rowErrors: ImportError[] = [];

    // Normalize keys to lowercase
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      row[k.toLowerCase().trim()] = v ?? '';
    }

    // Required: lot_number
    const lotNumberRaw = row['lot_number'];
    let lotNumber = 0;
    if (!lotNumberRaw || lotNumberRaw.trim() === '') {
      rowErrors.push({ rowIndex, field: 'lot_number', message: 'lot_number is required' });
    } else {
      const n = parseInt(lotNumberRaw.trim(), 10);
      if (isNaN(n) || n <= 0) {
        rowErrors.push({ rowIndex, field: 'lot_number', message: `lot_number must be a positive integer, got: "${lotNumberRaw}"` });
      } else {
        lotNumber = n;
      }
    }

    // Required: title
    const title = (row['title'] ?? '').trim();
    if (!title) {
      rowErrors.push({ rowIndex, field: 'title', message: 'title is required' });
    }

    // Optional numeric fields
    const estimateMin = parseIntRequired(row['estimate_min'], 'estimate_min', rowIndex, rowErrors);
    const estimateMax = parseIntRequired(row['estimate_max'], 'estimate_max', rowIndex, rowErrors);
    const reservePrice = parseIntOrNull(row['reserve_price'], 'reserve_price', rowIndex, rowErrors);
    const startingBid = parseIntOrNull(row['starting_bid'], 'starting_bid', rowIndex, rowErrors);

    // Year: optional, can be null
    let year: number | null = null;
    const yearRaw = row['year'];
    if (yearRaw && yearRaw.trim() !== '') {
      const y = parseInt(yearRaw.trim(), 10);
      if (isNaN(y) || y < 0 || y > 9999) {
        rowErrors.push({ rowIndex, field: 'year', message: `year must be a valid 4-digit year, got: "${yearRaw}"` });
      } else {
        year = y;
      }
    }

    // Cross-field validation: estimate_min <= estimate_max
    if (rowErrors.filter((e) => e.field === 'estimate_min' || e.field === 'estimate_max').length === 0) {
      if (estimateMin > estimateMax && estimateMax !== 0) {
        rowErrors.push({
          rowIndex,
          field: 'estimate_max',
          message: `estimate_max (${estimateMax}) must be >= estimate_min (${estimateMin})`,
        });
      }
    }

    errors.push(...rowErrors);

    // Only add valid rows (rows with no errors for this rowIndex)
    const thisRowHasErrors = rowErrors.some((e) => e.rowIndex === rowIndex);
    if (!thisRowHasErrors) {
      rows.push({
        rowIndex,
        lotNumber,
        title,
        artist: (row['artist'] ?? '').trim(),
        description: (row['description'] ?? '').trim(),
        medium: (row['medium'] ?? '').trim(),
        dimensions: (row['dimensions'] ?? '').trim(),
        year,
        estimateMin,
        estimateMax,
        reservePrice,
        startingBid,
        provenance: parseSemicolonList(row['provenance']),
        exhibitions: parseSemicolonList(row['exhibitions']),
      });
    }
  }

  return { rows, errors, totalRows: rawRows.length };
}

// ─── Bulk Insert ─────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importLots(
  auctionId: string,
  rows: ParsedLot[],
  adminId: string,
): Promise<ImportResult> {
  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: [] };
  }

  // Get current max sortOrder for this auction
  const [maxSortResult] = await db
    .select({ maxSort: max(lots.sortOrder) })
    .from(lots)
    .where(and(eq(lots.auctionId, auctionId), isNull(lots.deletedAt)));

  let nextSortOrder = (maxSortResult?.maxSort ?? -1) + 1;

  const importErrors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const [created] = await db
        .insert(lots)
        .values({
          auctionId,
          lotNumber: row.lotNumber,
          title: row.title,
          artist: row.artist,
          description: row.description,
          medium: row.medium,
          dimensions: row.dimensions,
          year: row.year,
          estimateMin: row.estimateMin,
          estimateMax: row.estimateMax,
          reservePrice: row.reservePrice,
          startingBid: row.startingBid,
          provenance: row.provenance,
          exhibitions: row.exhibitions,
          status: 'draft',
          sortOrder: nextSortOrder++,
          createdBy: adminId,
          updatedBy: adminId,
        })
        .returning();

      await logCreate(
        'lots',
        created.id,
        { ...created, importedViaCSV: true } as unknown as Record<string, unknown>,
        adminId,
        'admin',
      );

      imported++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Duplicate lot_number constraint violation is most likely cause
      importErrors.push(`Row ${row.rowIndex} (lot #${row.lotNumber}): ${message}`);
      skipped++;
    }
  }

  return { imported, skipped, errors: importErrors };
}
