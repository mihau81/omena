/**
 * Integration test setup file.
 * Runs before each integration test file.
 */

// Load .env first, then set DATABASE_URL for test database.
// In CI, DATABASE_URL is already set to the postgres service container — don't override it.
import 'dotenv/config';
if (!process.env.CI) {
  process.env.DATABASE_URL = 'postgresql://omena:omena_dev@localhost:5432/omena_test';
}

// Reset global auth mock state between test files to ensure isolation.
const _g = globalThis as { _omenaMockAuth?: { mockReset: () => void; mockResolvedValue: (v: unknown) => void }; _omenaMockSession?: unknown };
if (_g._omenaMockAuth) {
  _g._omenaMockAuth.mockReset();
  _g._omenaMockAuth.mockResolvedValue(null);
  _g._omenaMockSession = null;
} else {
  // Clear so a fresh vi.fn() is created when next-auth mock loads
  _g._omenaMockAuth = undefined;
  _g._omenaMockSession = null;
}
