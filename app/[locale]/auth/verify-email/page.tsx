'use client';

import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

const STATUS_CONTENT: Record<string, { icon: string; title: string; message: string; color: string }> = {
  approved: {
    icon: 'check',
    title: 'Welcome to Omenaa!',
    message: 'Your email has been verified and your account has been approved. You can now sign in.',
    color: 'green',
  },
  pending: {
    icon: 'clock',
    title: 'Email Verified',
    message: 'Your email has been verified successfully. Your account is now being reviewed by our team. You will receive an email once approved.',
    color: 'gold',
  },
  invalid: {
    icon: 'x',
    title: 'Invalid Link',
    message: 'This verification link is invalid or has already been used. Please request a new one.',
    color: 'red',
  },
  expired: {
    icon: 'x',
    title: 'Link Expired',
    message: 'This verification link has expired. Please register again to receive a new one.',
    color: 'red',
  },
  'already-verified': {
    icon: 'check',
    title: 'Already Verified',
    message: 'Your email address has already been verified. You can sign in to your account.',
    color: 'green',
  },
  error: {
    icon: 'x',
    title: 'Something Went Wrong',
    message: 'An error occurred while verifying your email. Please try again later.',
    color: 'red',
  },
};

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();
  const status = searchParams.get('status') || 'invalid';
  const content = STATUS_CONTENT[status] || STATUS_CONTENT['invalid'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">OMENAA</h1>
        </div>
        <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
          <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
            content.color === 'green' ? 'bg-green-100' : content.color === 'gold' ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            {content.icon === 'check' && (
              <svg className={`w-6 h-6 ${content.color === 'green' ? 'text-green-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
            {content.icon === 'clock' && (
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            )}
            {content.icon === 'x' && (
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h2 className="text-lg font-semibold text-dark-brown mb-2">{content.title}</h2>
          <p className="text-sm text-taupe mb-6">{content.message}</p>

          {(status === 'approved' || status === 'already-verified') && (
            <Link href={`/${locale}/login`} className="inline-block px-6 py-2.5 bg-gold text-white font-medium rounded-lg hover:bg-gold/90 transition-colors text-sm">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
