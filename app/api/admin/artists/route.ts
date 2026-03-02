import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getArtists, createArtist } from '@/db/queries/artists';
import { logCreate } from '@/lib/audit';

// ─── GET: List artists with search + pagination ───────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('lots:read');

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const search = searchParams.get('search') || undefined;

    const result = await getArtists({ search, page, limit });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('List artists error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create artist ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin('lots:write');

    const body = await request.json();
    const { name, slug, nationality, birthYear, deathYear, bio, imageUrl } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const artist = await createArtist({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      nationality: nationality || null,
      birthYear: birthYear ? parseInt(birthYear) : null,
      deathYear: deathYear ? parseInt(deathYear) : null,
      bio: bio || null,
      imageUrl: imageUrl || null,
    });

    await logCreate(
      'artists',
      artist.id,
      artist as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ artist }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    // Unique constraint on slug
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    console.error('Create artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
