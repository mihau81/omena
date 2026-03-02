'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function MagicLinkPage({ params }: { params: Promise<{ locale: string }> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No token provided');
      return;
    }

    signIn('magic-link-verify', { token, redirect: false })
      .then(async (result) => {
        if (result?.error) {
          setStatus('error');
          setError('This link is invalid or has expired. Please request a new one.');
        } else {
          setStatus('success');
          const { locale } = await params;
          router.push(`/${locale}`);
          router.refresh();
        }
      })
      .catch(() => {
        setStatus('error');
        setError('An unexpected error occurred');
      });
  }, [token, router, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">OMENA</h1>
        </div>
        <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
          {status === 'loading' && (
            <>
              <div className="w-8 h-8 mx-auto mb-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-taupe">Signing you in...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm text-taupe">Signed in! Redirecting...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-dark-brown mb-2">Sign-in Failed</h2>
              <p className="text-sm text-taupe">{error}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
