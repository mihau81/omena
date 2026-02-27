import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { admins } from '@/db/schema';
import { notDeleted } from '@/db/helpers';
import AdminsClient from './AdminsClient';

export const metadata: Metadata = {
  title: 'Admin Accounts',
};

export default async function AdminsPage() {
  let currentAdmin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    currentAdmin = await requireAdmin('admins:manage');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const rows = await db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      isActive: admins.isActive,
      totpEnabled: admins.totpEnabled,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .where(notDeleted(admins))
    .orderBy(desc(admins.createdAt));

  const serialized = rows.map((a) => ({
    ...a,
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <AdminsClient
      initialAdmins={serialized}
      currentAdminId={currentAdmin.id}
      currentAdminRole={currentAdmin.role ?? 'viewer'}
    />
  );
}
