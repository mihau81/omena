/**
 * Standalone admin account creation script.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts                          # interactive defaults
 *   npx tsx scripts/create-admin.ts --email admin@omena.pl --password Secret123 --role super_admin --name "Admin"
 *
 * Requires DATABASE_URL in .env (or exported).
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { hash } from 'bcryptjs';
import * as schema from '../db/schema';

// ─── CLI arg parsing ────────────────────────────────────────────────────────

function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const VALID_ROLES = ['super_admin', 'admin', 'cataloguer', 'auctioneer', 'viewer'] as const;
type AdminRole = (typeof VALID_ROLES)[number];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const email = getArg('email', 'admin@omena.pl');
  const password = getArg('password', 'Omena2026!');
  const role = getArg('role', 'super_admin') as AdminRole;
  const name = getArg('name', 'Administrator');

  if (!VALID_ROLES.includes(role)) {
    console.error(`ERROR: Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log(`Creating admin account: ${email} (${role})…`);
  const passwordHash = await hash(password, 12);

  try {
    const [admin] = await db
      .insert(schema.admins)
      .values({
        email,
        passwordHash,
        name,
        role,
        isActive: true,
      })
      .returning({ id: schema.admins.id, email: schema.admins.email });

    console.log(`✓ Admin created: ${admin.email} (id: ${admin.id})`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      console.error(`ERROR: An admin with email "${email}" already exists.`);
    } else {
      throw err;
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
