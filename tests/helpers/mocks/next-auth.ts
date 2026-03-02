import { vi } from 'vitest';
import type { AdminRole } from '@/lib/permissions';

// ─── Session state ────────────────────────────────────────────────────────────

type MockSessionUser = {
  id: string;
  email: string;
  name: string;
  userType: 'user' | 'admin';
  visibilityLevel: number;
  role: AdminRole | null;
};

// Use globalThis to share mock state across multiple module instances.
// This happens when vi.mock() async factories load this module in a separate
// module registry from the test file's top-level imports.
const _g = globalThis as {
  _omenaMockAuth?: ReturnType<typeof vi.fn>;
  _omenaMockSession?: { user: MockSessionUser } | null;
};

if (!_g._omenaMockAuth) {
  _g._omenaMockSession = null;
  _g._omenaMockAuth = vi.fn().mockImplementation(async () => _g._omenaMockSession);
}

export const mockAuth = _g._omenaMockAuth;

// ─── Session helpers ──────────────────────────────────────────────────────────

export function setMockSession(user: MockSessionUser) {
  _g._omenaMockSession = { user };
  _g._omenaMockAuth!.mockResolvedValue(_g._omenaMockSession);
}

export function clearMockSession() {
  _g._omenaMockSession = null;
  _g._omenaMockAuth!.mockResolvedValue(null);
}

export function setMockAdminSession(overrides: Partial<MockSessionUser> = {}) {
  setMockSession({
    id: 'test-admin-id',
    email: 'admin@omena.pl',
    name: 'Test Admin',
    userType: 'admin',
    visibilityLevel: 2,
    role: 'super_admin',
    ...overrides,
  });
}

export function setMockUserSession(overrides: Partial<MockSessionUser> = {}) {
  setMockSession({
    id: 'test-user-id',
    email: 'user@example.com',
    name: 'Test User',
    userType: 'user',
    visibilityLevel: 0,
    role: null,
    ...overrides,
  });
}

export function resetAuthMock() {
  _g._omenaMockSession = null;
  _g._omenaMockAuth!.mockReset();
  _g._omenaMockAuth!.mockResolvedValue(null);
}

// ─── Module mock factory ──────────────────────────────────────────────────────

export function authMockFactory() {
  return {
    auth: _g._omenaMockAuth!,
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: {
      GET: vi.fn(),
      POST: vi.fn(),
    },
  };
}
