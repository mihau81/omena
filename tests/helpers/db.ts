import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

// Load test env
import 'dotenv/config';

const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://omena:omena_dev@localhost:5432/omena_test';

let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getTestDb() {
  if (!testDb) {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    testDb = drizzle(testPool, { schema });
  }
  return testDb;
}

export async function setupTestDb() {
  const db = getTestDb();
  return db;
}

export async function teardownTestDb() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}

/**
 * Wraps a test function in a transaction that is always rolled back.
 * This ensures tests don't leave data behind.
 */
export async function withTransaction<T>(
  fn: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txDb = drizzle(client as unknown as Pool, { schema });
    const result = await fn(txDb);
    await client.query('ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Truncates a table (useful for cleanup between tests).
 */
export async function cleanTable(tableName: string) {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
  } finally {
    await pool.end();
  }
}
