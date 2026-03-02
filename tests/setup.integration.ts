/**
 * Integration test setup file.
 * Runs before each integration test file.
 */

// Load .env first, then override DATABASE_URL to use isolated test database.
// This ensures route handlers and test helpers both connect to omena_test.
import 'dotenv/config';
process.env.DATABASE_URL = 'postgresql://omena:omena_dev@localhost:5432/omena_test';

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
