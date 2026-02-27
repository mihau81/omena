import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'My Profile',
};

export default async function ProfilePage() {
  let currentAdmin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    currentAdmin = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      totpEnabled: admins.totpEnabled,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .where(eq(admins.id, currentAdmin.id))
    .limit(1);

  if (!admin) redirect('/admin/login');

  const serialized = {
    ...admin,
    lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
    createdAt: admin.createdAt.toISOString(),
  };

  return <ProfileClient admin={serialized} />;
}
