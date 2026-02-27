import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getAuditLog } from '@/db/queries/audit';
import AuditLogClient from './AuditLogClient';

export const metadata: Metadata = {
  title: 'Audit Log',
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  try {
    await requireAdmin('audit:read');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(String(params.page ?? '1')));
  const tableName = String(params.tableName ?? '');
  const action = String(params.action ?? '');
  const performedBy = String(params.performedBy ?? '');
  const recordId = String(params.recordId ?? '');
  const dateFrom = String(params.dateFrom ?? '');
  const dateTo = String(params.dateTo ?? '');

  const result = await getAuditLog({
    tableName: tableName || undefined,
    action: action || undefined,
    performedBy: performedBy || undefined,
    recordId: recordId || undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
    page,
    limit: 50,
  });

  // Serialize dates for client component
  const serialized = {
    ...result,
    data: result.data.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      oldData: row.oldData as Record<string, unknown> | null,
      newData: row.newData as Record<string, unknown> | null,
      changedFields: row.changedFields as string[] | null,
    })),
  };

  return (
    <AuditLogClient
      initialData={serialized}
      filters={{ tableName, action, performedBy, recordId, dateFrom, dateTo }}
    />
  );
}
