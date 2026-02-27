import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';

// ─── GET: Download CSV import template ──────────────────────────────────────

const TEMPLATE_CONTENT = [
  'lot_number,title,artist,description,medium,dimensions,year,estimate_min,estimate_max,reserve_price,starting_bid,provenance,exhibitions',
  '1,"Obraz Olejny","Jan Kowalski","Piękny pejzaż","Olej na płótnie","100x80 cm",2020,50000,80000,40000,30000,"Kolekcja prywatna;Galeria ABC","Wystawa 2021;Biennale 2022"',
  '2,"Rzeźba Marmurowa","Anna Nowak","Abstrakcja","Marmur","40x20x20 cm",2019,120000,150000,,,"Zbiory rodzinne",""',
].join('\r\n');

export async function GET() {
  try {
    await requireAdmin('lots:read');

    return new NextResponse(TEMPLATE_CONTENT, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lot-import-template.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Template download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
