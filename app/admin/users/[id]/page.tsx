import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { redirect, notFound } from 'next/navigation';
import { getUserDetail } from '@/db/queries/users';
import UserDetailClient from './UserDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  try {
    await requireAdmin('users:read');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  const { id } = await params;
  const user = await getUserDetail(id);

  if (!user) {
    notFound();
  }

  // Serialize dates for client component
  const serialized = {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  return <UserDetailClient user={serialized} />;
}
