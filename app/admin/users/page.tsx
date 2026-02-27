import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { listUsers } from '@/db/queries/users';
import UsersClient from './UsersClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  try {
    await requireAdmin('users:read');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(String(params.page ?? '1')));
  const search = String(params.search ?? '');
  const visibilityLevel = params.visibilityLevel as '0' | '1' | '2' | undefined;
  const isActiveParam = params.isActive;
  const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

  const result = await listUsers({
    search: search || undefined,
    visibilityLevel: visibilityLevel || undefined,
    isActive,
    page,
    limit: 20,
  });

  // Serialize dates for client component
  const serialized = {
    ...result,
    data: result.data.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
  };

  return (
    <UsersClient
      initialData={serialized}
      initialSearch={search}
      initialVisibility={visibilityLevel ?? ''}
      initialIsActive={isActiveParam as string ?? ''}
    />
  );
}
