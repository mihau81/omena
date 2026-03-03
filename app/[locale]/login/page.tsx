'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/auth/magic-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });

      if (res.ok) {
        setMagicLinkSent(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send magic link');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('user-credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        const next = searchParams.get('next');
        router.push(next || `/${locale}`);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6">
            <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">OMENA</h1>
          </div>
          <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-dark-brown mb-2">Check your email</h2>
            <p className="text-sm text-taupe mb-4">
              We sent a sign-in link to <strong className="text-dark-brown">{email}</strong>. Click the link to sign in.
            </p>
            <button
              onClick={() => setMagicLinkSent(false)}
              className="text-sm text-gold hover:underline"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">
            OMENA
          </h1>
          <p className="text-sm text-taupe mt-1">Sign in to your account</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
          {/* Magic Link — primary */}
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-brown mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 px-4 bg-gold text-white font-medium rounded-lg hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading && !showPassword ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Sending...
                </span>
              ) : (
                'Send magic link'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-beige" />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-taupe hover:text-gold transition-colors"
            >
              {showPassword ? 'hide' : 'or sign in with password'}
            </button>
            <div className="flex-1 h-px bg-beige" />
          </div>

          {/* Password login — collapsible */}
          {showPassword && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark-brown mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-dark-brown text-white font-medium rounded-lg hover:bg-dark-brown/90 focus:outline-none focus:ring-2 focus:ring-dark-brown/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="text-right">
                <Link href={`/${locale}/auth/reset-password`} className="text-xs text-gold hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-taupe mt-6">
          Don&apos;t have an account?{' '}
          <Link href={`/${locale}/register`} className="text-gold hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
