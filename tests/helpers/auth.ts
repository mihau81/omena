import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getTestDb } from './db';
import { users, admins } from '@/db/schema';
import type { AdminRole } from '@/lib/permissions';

export type TestUser = {
  id: string;
  email: string;
  name: string;
  userType: 'user';
  visibilityLevel: number;
  role: null;
};

export type TestAdmin = {
  id: string;
  email: string;
  name: string;
  userType: 'admin';
  visibilityLevel: number;
  role: AdminRole;
};

type UserOverrides = Partial<{
  email: string;
  name: string;
  password: string;
  phone: string;
  visibilityLevel: '0' | '1' | '2';
  isActive: boolean;
  emailVerified: boolean;
  accountStatus: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected' | 'deactivated';
  registrationSource: 'direct' | 'whitelist' | 'invitation' | 'qr_code';
}>;

type AdminOverrides = Partial<{
  email: string;
  name: string;
  password: string;
  role: AdminRole;
  isActive: boolean;
  totpEnabled: boolean;
}>;

let userCounter = 0;
let adminCounter = 0;

export async function createTestUser(overrides: UserOverrides = {}): Promise<TestUser> {
  const db = getTestDb();
  const idx = ++userCounter;
  const password = overrides.password ?? 'TestPassword123!';
  const passwordHash = await bcrypt.hash(password, 1); // Low rounds for speed in tests

  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `test-user-${idx}@example.com`,
      name: overrides.name ?? `Test User ${idx}`,
      phone: overrides.phone ?? '',
      passwordHash,
      visibilityLevel: overrides.visibilityLevel ?? '0',
      isActive: overrides.isActive ?? true,
      emailVerified: overrides.emailVerified ?? true,
      accountStatus: overrides.accountStatus ?? 'approved',
      registrationSource: overrides.registrationSource ?? 'direct',
    })
    .returning();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    userType: 'user',
    visibilityLevel: parseInt(user.visibilityLevel),
    role: null,
  };
}

export async function createTestAdmin(overrides: AdminOverrides = {}): Promise<TestAdmin> {
  const db = getTestDb();
  const idx = ++adminCounter;
  const password = overrides.password ?? 'AdminPassword123!';
  const passwordHash = await bcrypt.hash(password, 1);

  const [admin] = await db
    .insert(admins)
    .values({
      email: overrides.email ?? `test-admin-${idx}@example.com`,
      name: overrides.name ?? `Test Admin ${idx}`,
      passwordHash,
      role: overrides.role ?? 'admin',
      isActive: overrides.isActive ?? true,
      totpEnabled: overrides.totpEnabled ?? false,
    })
    .returning();

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    userType: 'admin',
    visibilityLevel: 2,
    role: admin.role as AdminRole,
  };
}

/**
 * Generates a simple JWT-like token for API testing.
 * In tests, we mock the auth() function instead of creating real JWTs.
 */
export function getToken(user: TestUser | TestAdmin): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      userType: user.userType,
      visibilityLevel: user.visibilityLevel,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    }),
  ).toString('base64');
  return `test.${payload}.signature`;
}
