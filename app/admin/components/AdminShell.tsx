'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { apiUrl } from '@/app/lib/utils';

interface AdminShellProps {
  userName: string;
  userRole: string | null;
  children: React.ReactNode;
}

export default function AdminShell({ userName, userRole, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  useEffect(() => {
    fetch(apiUrl('/api/admin/users/pending-count'))
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.count != null) setPendingUsersCount(data.count);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-cream/50 overflow-hidden">
      <AdminSidebar
        role={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingUsersCount={pendingUsersCount}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <AdminHeader
          userName={userName}
          userRole={userRole}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
