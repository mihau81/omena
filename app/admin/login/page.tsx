'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requiresTOTP) {
        // Second step: verify TOTP
        if (!totpCode || totpCode.length !== 6) {
          setError('Please enter a valid 6-digit code');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, totpCode }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'TOTP verification failed');
        } else {
          router.push('/admin');
        }
      } else {
        // First step: verify password
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Invalid email or password');
        } else {
          const data = await res.json();
          if (data.requiresTOTP) {
            setRequiresTOTP(true);
          } else {
            router.push('/admin');
          }
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">
            OMENA
          </h1>
          <p className="text-sm text-taupe mt-1">Administration Panel</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark-brown mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requiresTOTP && (
              <>
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
                    placeholder="admin@omena.art"
                  />
                </div>

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
              </>
            )}

            {requiresTOTP && (
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-dark-brown mb-1.5">
                  Authenticator Code
                </label>
                <input
                  id="totp"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoComplete="off"
                  maxLength={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              {requiresTOTP && (
                <button
                  type="button"
                  onClick={() => {
                    setRequiresTOTP(false);
                    setTotpCode('');
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-beige text-dark-brown font-medium rounded-lg hover:bg-beige/80 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading || (requiresTOTP && totpCode.length !== 6)}
                className={`${requiresTOTP ? 'flex-1' : 'w-full'} py-2.5 px-4 bg-dark-brown text-white font-medium rounded-lg hover:bg-dark-brown/90 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {requiresTOTP ? 'Verifying...' : 'Signing in...'}
                  </span>
                ) : (
                  requiresTOTP ? 'Verify' : 'Sign In'
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-taupe/60 mt-6">
          Admin accounts are managed by super administrators.
        </p>
      </div>
    </div>
  );
}
