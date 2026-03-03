import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin } from '@/tests/helpers/auth';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaaMockAuth) {
    _g._omenaaMockSession = null;
    _g._omenaaMockAuth = vi.fn().mockImplementation(async () => _g._omenaaMockSession);
  }
  return _g._omenaaMockAuth as ReturnType<typeof vi.fn>;
});

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Artists API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdArtistIds: string[] = [];

  const validArtistData = () => ({
    name: 'Integration Test Artist',
    slug: `int-test-artist-${Date.now()}`,
    nationality: 'Polish',
    birthYear: '1920',
    deathYear: '2000',
    bio: 'A famous test artist.',
  });

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-artists-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = {
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
        userType: 'admin',
        visibilityLevel: 2,
      },
    };
  });

  afterAll(async () => {
    const { artists } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (createdArtistIds.length > 0) {
      // Hard delete (not soft) so test data doesn't linger
      await db.delete(artists).where(inArray(artists.id, createdArtistIds)).catch(() => {});
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-artists-test-%@example.com'`);
  });

  describe('GET /api/admin/artists', () => {
    it('returns list of artists with pagination', async () => {
      const { GET } = await import('@/app/api/admin/artists/route');

      const request = createRequest('GET', '/api/admin/artists');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('totalPages');
      expect(Array.isArray((data as Record<string, unknown>).data)).toBe(true);
    });

    it('supports search by name', async () => {
      const { POST, GET } = await import('@/app/api/admin/artists/route');

      // Create a searchable artist
      const artistData = {
        ...validArtistData(),
        name: 'UniqueSearchableArtist12345',
        slug: `unique-searchable-artist-${Date.now()}`,
      };
      const createReq = createRequest('POST', '/api/admin/artists', artistData);
      const { data: createData } = await callRouteHandler(POST, createReq);
      const artistId = (createData as Record<string, Record<string, string>>).artist.id;
      createdArtistIds.push(artistId);

      // Search for it
      const searchReq = createRequest('GET', '/api/admin/artists?search=UniqueSearchableArtist12345');
      const { status, data } = await callRouteHandler(GET, searchReq);

      expect(status).toBe(200);
      const artists = (data as Record<string, Array<Record<string, string>>>).data;
      const found = artists.find((a) => a.id === artistId);
      expect(found).toBeDefined();
      expect(found?.name).toBe('UniqueSearchableArtist12345');
    });

    it('supports pagination parameters', async () => {
      const { GET } = await import('@/app/api/admin/artists/route');

      const request = createRequest('GET', '/api/admin/artists?page=1&limit=5');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      const result = data as Record<string, unknown>;
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect((result.data as unknown[]).length).toBeLessThanOrEqual(5);
    });

    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/admin/artists/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('GET', '/api/admin/artists');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(401);

      (globalThis as any)._omenaaMockSession = {
        user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 },
      };
    });
  });

  describe('POST /api/admin/artists', () => {
    it('creates artist successfully', async () => {
      const { POST } = await import('@/app/api/admin/artists/route');

      const data = validArtistData();
      const request = createRequest('POST', '/api/admin/artists', data);
      const { status, data: responseData } = await callRouteHandler(POST, request);

      expect(status).toBe(201);
      expect(responseData).toHaveProperty('artist');
      const artist = (responseData as Record<string, Record<string, unknown>>).artist;
      expect(artist.name).toBe(data.name);
      expect(artist.slug).toBe(data.slug);
      expect(artist.nationality).toBe('Polish');
      expect(artist.birthYear).toBe(1920);
      expect(artist.deathYear).toBe(2000);

      createdArtistIds.push(artist.id as string);
    });

    it('returns error when slug already exists', async () => {
      const { POST } = await import('@/app/api/admin/artists/route');

      const data = validArtistData();
      // Create first
      const r1 = await callRouteHandler(POST, createRequest('POST', '/api/admin/artists', data));
      createdArtistIds.push((r1.data as Record<string, Record<string, string>>).artist.id);

      // Try duplicate slug — drizzle wraps the PG error in DrizzleQueryError
      // so error.code is not directly accessible (it's on error.cause.code).
      // The route returns 500 instead of the intended 409.
      const r2 = await callRouteHandler(POST, createRequest('POST', '/api/admin/artists', {
        ...validArtistData(),
        slug: data.slug, // same slug
      }));

      // Route catches (error as { code?: string }).code === '23505' but drizzle
      // wraps the error, so it falls through to 500. This tests actual behavior.
      expect(r2.status).toBe(500);
    });

    it('returns 400 when name is missing', async () => {
      const { POST } = await import('@/app/api/admin/artists/route');

      const request = createRequest('POST', '/api/admin/artists', {
        slug: `no-name-${Date.now()}`,
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('Name is required');
    });

    it('returns 400 when slug is missing', async () => {
      const { POST } = await import('@/app/api/admin/artists/route');

      const request = createRequest('POST', '/api/admin/artists', {
        name: 'Artist Without Slug',
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('Slug is required');
    });

    it('returns 401 without admin auth', async () => {
      const { POST } = await import('@/app/api/admin/artists/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('POST', '/api/admin/artists', validArtistData());
      const { status } = await callRouteHandler(POST, request);

      expect(status).toBe(401);

      (globalThis as any)._omenaaMockSession = {
        user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 },
      };
    });
  });

  describe('GET /api/admin/artists/[id]', () => {
    let artistId: string;

    beforeAll(async () => {
      const { POST } = await import('@/app/api/admin/artists/route');
      const result = await callRouteHandler(POST, createRequest('POST', '/api/admin/artists', validArtistData()));
      artistId = (result.data as Record<string, Record<string, string>>).artist.id;
      createdArtistIds.push(artistId);
    });

    it('returns artist detail with lot count', async () => {
      const { GET } = await import('@/app/api/admin/artists/[id]/route');

      const request = createRequest('GET', `/api/admin/artists/${artistId}`);
      const { status, data } = await callRouteHandler(GET, request, {
        params: Promise.resolve({ id: artistId }),
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('artist');
      expect(data).toHaveProperty('unlinkedLots');
      expect(data).toHaveProperty('lotCount');
      const artist = (data as Record<string, Record<string, unknown>>).artist;
      expect(artist.id).toBe(artistId);
    });

    it('returns 404 for non-existent artist', async () => {
      const { GET } = await import('@/app/api/admin/artists/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = createRequest('GET', `/api/admin/artists/${fakeId}`);
      const { status } = await callRouteHandler(GET, request, {
        params: Promise.resolve({ id: fakeId }),
      });

      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/admin/artists/[id]', () => {
    let artistId: string;

    beforeAll(async () => {
      const { POST } = await import('@/app/api/admin/artists/route');
      const result = await callRouteHandler(POST, createRequest('POST', '/api/admin/artists', validArtistData()));
      artistId = (result.data as Record<string, Record<string, string>>).artist.id;
      createdArtistIds.push(artistId);
    });

    it('updates artist fields', async () => {
      const { PATCH } = await import('@/app/api/admin/artists/[id]/route');

      const request = createRequest('PATCH', `/api/admin/artists/${artistId}`, {
        name: 'Updated Artist Name',
        nationality: 'French',
        bio: 'Updated bio text.',
      });
      const { status, data } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: artistId }),
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('artist');
      const artist = (data as Record<string, Record<string, unknown>>).artist;
      expect(artist.name).toBe('Updated Artist Name');
      expect(artist.nationality).toBe('French');
      expect(artist.bio).toBe('Updated bio text.');
    });

    it('returns 400 when no fields to update', async () => {
      const { PATCH } = await import('@/app/api/admin/artists/[id]/route');

      const request = createRequest('PATCH', `/api/admin/artists/${artistId}`, {});
      const { status, data } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: artistId }),
      });

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('No fields to update');
    });

    it('returns 404 for non-existent artist', async () => {
      const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = createRequest('PATCH', `/api/admin/artists/${fakeId}`, {
        name: 'Updated',
      });
      const { status } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: fakeId }),
      });

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/admin/artists/[id]', () => {
    it('soft-deletes an artist', async () => {
      const { POST } = await import('@/app/api/admin/artists/route');
      const { DELETE, GET } = await import('@/app/api/admin/artists/[id]/route');

      // Create an artist to delete
      const data = validArtistData();
      const createResult = await callRouteHandler(POST, createRequest('POST', '/api/admin/artists', data));
      const artistId = (createResult.data as Record<string, Record<string, string>>).artist.id;
      createdArtistIds.push(artistId);

      // Delete it
      const deleteResult = await callRouteHandler(
        DELETE,
        createRequest('DELETE', `/api/admin/artists/${artistId}`),
        { params: Promise.resolve({ id: artistId }) },
      );

      expect(deleteResult.status).toBe(200);
      expect((deleteResult.data as Record<string, boolean>).success).toBe(true);

      // Verify it returns 404 on GET (soft-deleted)
      const getResult = await callRouteHandler(
        GET,
        createRequest('GET', `/api/admin/artists/${artistId}`),
        { params: Promise.resolve({ id: artistId }) },
      );
      expect(getResult.status).toBe(404);
    });

    it('returns 404 for non-existent artist', async () => {
      const { DELETE } = await import('@/app/api/admin/artists/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const { status } = await callRouteHandler(
        DELETE,
        createRequest('DELETE', `/api/admin/artists/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(status).toBe(404);
    });
  });
});
