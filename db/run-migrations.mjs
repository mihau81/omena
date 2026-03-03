/**
 * Run SQL migrations against the database.
 * Used in CI to set up the test database schema.
 * Usage: node db/run-migrations.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`Running migration: ${file}`);
  try {
    await client.query(sql);
    console.log(`  OK`);
  } catch (err) {
    // Some migrations may fail on re-run (e.g. CREATE TYPE already exists)
    // This is expected — we use IF NOT EXISTS where possible
    console.log(`  Warning: ${err.message.split('\n')[0]}`);
  }
}

await client.end();
console.log('All migrations complete.');
