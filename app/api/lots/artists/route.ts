import { NextRequest, NextResponse } from 'next/server';
import { getDistinctArtists } from '@/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  try {
    const artists = await getDistinctArtists(q.length >= 2 ? q : undefined);
    return NextResponse.json({ artists });
  } catch (error) {
    console.error('Artists autocomplete error:', error);
    return NextResponse.json({ artists: [] });
  }
}
