import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { settings } from '@/db/schema';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  try {
    await requireAdmin('settings:manage');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const rows = await db
    .select()
    .from(settings)
    .orderBy(settings.category, settings.key);

  // Group by category and serialize dates
  const grouped: Record<string, Array<{
    id: string;
    key: string;
    value: string;
    category: string;
    label: string;
    description: string | null;
    updatedAt: string;
  }>> = {};

  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Settings</h1>
        <p className="text-sm text-taupe mt-1">Manage auction house configuration</p>
      </div>
      <SettingsClient initialSettings={grouped} />
    </div>
  );
}
