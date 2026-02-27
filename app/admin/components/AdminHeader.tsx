import Link from 'next/link';
import AdminLogout from './AdminLogout';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  cataloguer: 'Cataloguer',
  auctioneer: 'Auctioneer',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800',
  admin: 'bg-gold/20 text-gold-dark',
  cataloguer: 'bg-blue-100 text-blue-800',
  auctioneer: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-600',
};

interface AdminHeaderProps {
  userName: string;
  userRole: string | null;
  onMenuToggle: () => void;
}

export default function AdminHeader({ userName, userRole, onMenuToggle }: AdminHeaderProps) {
  const roleLabel = userRole ? ROLE_LABELS[userRole] ?? userRole : 'Unknown';
  const roleColor = userRole ? ROLE_COLORS[userRole] ?? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600';

  return (
    <header className="h-16 bg-white border-b border-beige flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-taupe hover:bg-beige/50 transition-colors"
          aria-label="Open navigation menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        {/* Mobile title */}
        <span className="lg:hidden text-base font-serif font-bold text-dark-brown tracking-wide">
          Omena Admin
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* Avatar circle */}
          <div className="w-8 h-8 rounded-full bg-dark-brown text-white flex items-center justify-center text-sm font-medium">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <Link href="/admin/profile" className="text-sm font-medium text-dark-brown leading-tight hover:text-gold transition-colors">
              {userName}
            </Link>
            <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>
        <div className="w-px h-8 bg-beige" />
        <AdminLogout />
      </div>
    </header>
  );
}
