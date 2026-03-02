import Link from 'next/link';

export default async function PendingApprovalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">OMENA</h1>
        </div>
        <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-dark-brown mb-2">Awaiting Approval</h2>
          <p className="text-sm text-taupe mb-6">
            Your email has been verified. Your account is now being reviewed by our team. You will receive an email once your account has been approved.
          </p>
          <Link href={`/${locale}/login`} className="text-sm text-gold hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
