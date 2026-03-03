/**
 * Run SQL migrations against the database.
 * Used in CI to set up the test database schema.
 * Usage: node db/run-migrations.mjs
 *
 * Executes each migration file as a whole.
 * On fresh DB (CI), all should succeed in order.
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

let failed = 0;

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`Running migration: ${file}`);
  try {
    await client.query(sql);
    console.log(`  OK`);
  } catch (err) {
    const msg = err.message.split('\n')[0];
    console.log(`  FAILED: ${msg}`);
    failed++;
  }
}

await client.end();

if (failed > 0) {
  console.log(`\n${failed} migration(s) failed!`);
  process.exit(1);
} else {
  console.log('All migrations complete.');
}
