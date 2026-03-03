/**
 * Integration test setup file.
 * Runs before each integration test file.
 */

// Load .env first, then set DATABASE_URL for test database.
// In CI, DATABASE_URL is already set to the postgres service container — don't override it.
import 'dotenv/config';
if (!process.env.CI) {
  process.env.DATABASE_URL = 'postgresql://omenaa:omenaa_dev@localhost:5432/omenaa_test';
}

// Reset global auth mock state between test files to ensure isolation.
const _g = globalThis as { _omenaaMockAuth?: { mockReset: () => void; mockResolvedValue: (v: unknown) => void }; _omenaaMockSession?: unknown };
if (_g._omenaaMockAuth) {
  _g._omenaaMockAuth.mockReset();
  _g._omenaaMockAuth.mockResolvedValue(null);
  _g._omenaaMockSession = null;
} else {
  // Clear so a fresh vi.fn() is created when next-auth mock loads
  _g._omenaaMockAuth = undefined;
  _g._omenaaMockSession = null;
}
