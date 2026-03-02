import { NextResponse } from 'next/server';
import { fetchNBPRates } from '@/lib/currency';

export async function GET() {
  const rates = await fetchNBPRates();
  return NextResponse.json(
    { rates },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
