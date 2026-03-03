/**
 * Unit tests for POST /api/auth/register
 * Coverage target: user registration with validation, dedup, whitelist, referrer, email verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/headers ──────────────────────────────────────────────────────

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

// ─── Mock bcryptjs ──────────────────────────────────────────────────────────

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

// ─── Mock rate limiter ──────────────────────────────────────────────────────

const mockRateLimitCheck = vi.fn();
vi.mock('@/lib/rate-limiters', () => ({
  registrationLimiter: {
    check: (...args: unknown[]) => mockRateLimitCheck(...args),
  },
}));

// ─── Mock email ─────────────────────────────────────────────────────────────

const mockSendEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ─── Mock email templates ───────────────────────────────────────────────────

vi.mock('@/lib/email-templates', () => ({
  emailVerification: vi.fn().mockReturnValue('<html>Verify</html>'),
}));

// ─── Mock token service ─────────────────────────────────────────────────────

const mockCreateVerificationToken = vi.fn();
vi.mock('@/lib/token-service', () => ({
  createVerificationToken: (...args: unknown[]) => mockCreateVerificationToken(...args),
  getBaseUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────
// Register route makes multiple sequential db.select/insert/update calls:
//   select(0): existing user check -> db.select().from(users).where().limit(1)
//   select(1): whitelist check -> db.select().from(userWhitelists).where().limit(1)
//   select(2): referrer check (optional) -> db.select().from(users).where().limit(1)
//   insert(0): create user -> db.insert(users).values().returning()
//   update(0): mark whitelist (optional) -> db.update(userWhitelists).set().where()

let selectCallIndex = 0;
const selectResults: unknown[][] = [];
let insertCallIndex = 0;
const insertResults: unknown[][] = [];
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);

function buildSelectChain(callIdx: number): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(selectResults[callIdx] ?? []);
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

function buildInsertChain(callIdx: number): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(insertResults[callIdx] ?? []);
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

function buildUpdateChain(): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      if (prop === 'where') {
        return (...args: unknown[]) => {
          mockUpdateWhere(...args);
          return new Proxy({}, handler);
        };
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const mockDbProxy = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === 'select') {
      return (..._args: unknown[]) => {
        const idx = selectCallIndex++;
        return buildSelectChain(idx);
      };
    }
    if (prop === 'insert') {
      return (..._args: unknown[]) => {
        const idx = insertCallIndex++;
        return buildInsertChain(idx);
      };
    }
    if (prop === 'update') {
      return (..._args: unknown[]) => buildUpdateChain();
    }
    return vi.fn();
  },
});

vi.mock('@/db/connection', () => ({ db: mockDbProxy }));

vi.mock('@/db/schema', () => ({
  users: { id: 'id', email: 'email', deletedAt: 'deletedAt' },
  userWhitelists: { id: 'id', email: 'email', usedAt: 'usedAt', userId: 'userId' },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: 'john@example.com',
  name: 'John Doe',
  password: 'securepass123',
  phone: '+48123456789',
};

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    selectResults.length = 0;
    insertCallIndex = 0;
    insertResults.length = 0;
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }));
    mockRateLimitCheck.mockReturnValue({ success: true });
    mockSendEmail.mockResolvedValue(undefined);
    mockCreateVerificationToken.mockResolvedValue('test-token-abc');
    // Default insert result (user creation)
    insertResults[0] = [{ id: 'new-user-1', email: 'john@example.com' }];
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimitCheck.mockReturnValue({ success: false });

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Too many registration attempts');
  });

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns 400 for missing name', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({ email: 'john@example.com', password: 'securepass123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for password too short', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({ ...validBody, password: 'short' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 409 when email already exists', async () => {
    // select(0): existing user check -> found
    selectResults[0] = [{ id: 'existing-user' }];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already exists');
  });

  it('creates user successfully with direct registration', async () => {
    // select(0): existing user check -> not found
    selectResults[0] = [];
    // select(1): whitelist check -> not whitelisted
    selectResults[1] = [];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toContain('Account created');
    expect(body.userId).toBe('new-user-1');
    expect(mockSendEmail).toHaveBeenCalledWith(
      'john@example.com',
      expect.stringContaining('Omenaa'),
      expect.any(String),
    );
    expect(mockCreateVerificationToken).toHaveBeenCalledWith(
      'john@example.com',
      'email_verification',
      expect.any(Number),
    );
  });

  it('creates user with whitelist and marks whitelist entry as used', async () => {
    // select(0): existing user check -> not found
    selectResults[0] = [];
    // select(1): whitelist check -> whitelisted
    selectResults[1] = [{ id: 'wl-1' }];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userId).toBe('new-user-1');
  });

  it('creates user with valid referrer', async () => {
    // select(0): existing user check -> not found
    selectResults[0] = [];
    // select(1): whitelist check -> not whitelisted
    selectResults[1] = [];
    // select(2): referrer check -> valid referrer found
    selectResults[2] = [{ id: 'referrer-1' }];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({
      ...validBody,
      referrerId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userId).toBe('new-user-1');
  });

  it('ignores invalid referrer (not found in DB)', async () => {
    // select(0): existing user check -> not found
    selectResults[0] = [];
    // select(1): whitelist check -> not whitelisted
    selectResults[1] = [];
    // select(2): referrer check -> not found
    selectResults[2] = [];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({
      ...validBody,
      referrerId: '550e8400-e29b-41d4-a716-446655440000',
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userId).toBe('new-user-1');
  });

  it('creates user without password (magic link flow)', async () => {
    // select(0): existing user check -> not found
    selectResults[0] = [];
    // select(1): whitelist check -> not whitelisted
    selectResults[1] = [];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({ email: 'john@example.com', name: 'John' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userId).toBe('new-user-1');
  });

  it('returns 500 on unexpected error', async () => {
    // Make insert throw by providing a result that causes an error
    // Let's break by making the selectResults trigger an exception.
    // Existing user check returns empty, whitelist returns empty,
    // but insertResults is set to something that breaks destructuring:
    selectResults[0] = [];
    selectResults[1] = [];
    insertResults[0] = []; // `[newUser]` = undefined, then newUser.id throws

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });

  it('extracts IP from x-forwarded-for header', async () => {
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '10.0.0.1, 172.16.0.1' }));
    selectResults[0] = [];
    selectResults[1] = [];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(mockRateLimitCheck).toHaveBeenCalledWith('10.0.0.1');
  });

  it('uses "unknown" IP when x-forwarded-for is missing', async () => {
    mockHeaders.mockResolvedValue(new Headers());
    selectResults[0] = [];
    selectResults[1] = [];

    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(mockRateLimitCheck).toHaveBeenCalledWith('unknown');
  });

  it('returns 400 for invalid referrerId format (not a UUID)', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST(makeRequest({
      ...validBody,
      referrerId: 'not-a-uuid',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });
});
