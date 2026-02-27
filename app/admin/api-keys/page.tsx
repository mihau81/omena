import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { apiKeys } from '@/db/schema';
import ApiKeysClient from './ApiKeysClient';

export const metadata: Metadata = {
  title: 'API Keys',
};

export default async function ApiKeysPage() {
  try {
    await requireAdmin('settings:manage');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      rateLimit: apiKeys.rateLimit,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));

  const serialized = rows.map((k) => ({
    ...k,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
  }));

  return <ApiKeysClient initialKeys={serialized} />;
}
