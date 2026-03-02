import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import {
  getArtistById,
  getUnlinkedLotsByArtistName,
  updateArtist,
  deleteArtist,
  linkLotsToArtist,
} from '@/db/queries/artists';
import { logUpdate, logDelete } from '@/lib/audit';
import { db } from '@/db/connection';
import { lots } from '@/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: Artist detail + unlinked lots ──────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin('lots:read');
    const { id } = await params;

    const artist = await getArtistById(id);
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const unlinkedLots = artist.name
      ? await getUnlinkedLotsByArtistName(artist.name)
      : [];

    // Count linked lots
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lots)
      .where(sql`${lots.artistId} = ${id} AND ${lots.deletedAt} IS NULL`);

    return NextResponse.json({ artist, unlinkedLots, lotCount: count });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Get artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update artist ─────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const existing = await getArtistById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const body = await request.json();

    // Handle bulk-link lots action
    if (body.action === 'link-lots' && Array.isArray(body.lotIds)) {
      await linkLotsToArtist(id, body.lotIds);
      return NextResponse.json({ success: true, linked: body.lotIds.length });
    }

    const { name, slug, nationality, birthYear, deathYear, bio, imageUrl } = body;

    const updateData: Parameters<typeof updateArtist>[1] = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (nationality !== undefined) updateData.nationality = nationality || null;
    if (birthYear !== undefined) updateData.birthYear = birthYear ? parseInt(birthYear) : null;
    if (deathYear !== undefined) updateData.deathYear = deathYear ? parseInt(deathYear) : null;
    if (bio !== undefined) updateData.bio = bio || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await updateArtist(id, updateData);

    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};
    for (const key of Object.keys(updateData) as (keyof typeof updateData)[]) {
      oldData[key] = existing[key as keyof typeof existing];
      newData[key] = updateData[key];
    }
    await logUpdate('artists', id, oldData, newData, admin.id, 'admin');

    return NextResponse.json({ artist: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    console.error('Update artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete artist ───────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const existing = await getArtistById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Unlink lots before deleting
    await db
      .update(lots)
      .set({ artistId: null, updatedAt: new Date() })
      .where(eq(lots.artistId, id));

    await deleteArtist(id);

    await logDelete(
      'artists',
      id,
      { name: existing.name, slug: existing.slug },
      admin.id,
      'admin',
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Delete artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
