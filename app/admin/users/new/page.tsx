import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UserForm from '../../components/UserForm';

export default async function NewUserPage() {
  try {
    await requireAdmin('users:write');
  } catch (e) {
    if (e instanceof AuthError) redirect('/admin/login');
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-taupe mb-2">
          <Link href="/admin/users" className="hover:text-dark-brown transition-colors">Users</Link>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-dark-brown">New User</span>
        </div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Create New User</h1>
        <p className="text-sm text-taupe mt-1">
          A temporary password will be generated for the user.
        </p>
      </div>

      <UserForm mode="create" />
    </div>
  );
}
