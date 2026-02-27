import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminShell from './components/AdminShell';

export const metadata: Metadata = {
  title: {
    default: 'Admin Panel',
    template: '%s | Omena Admin',
  },
  robots: 'noindex, nofollow',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.userType === 'admin';

  // If not authenticated as admin, render children without admin shell
  // (the login page will render standalone, middleware handles redirects for other pages)
  if (!isAdmin) {
    return <>{children}</>;
  }

  return (
    <AdminShell
      userName={session.user.name}
      userRole={session.user.role}
    >
      {children}
    </AdminShell>
  );
}
