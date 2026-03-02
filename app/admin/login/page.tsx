'use client';

import { useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Pre-auth — validate credentials and check TOTP
      if (!requiresTOTP) {
        const preAuth = await fetch(apiUrl('/api/admin/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const preData = await preAuth.json();

        if (!preAuth.ok) {
          setError(preData.error || 'Invalid email or password');
          setLoading(false);
          return;
        }

        if (preData.requiresTOTP) {
          setRequiresTOTP(true);
          setLoading(false);
          return;
        }
      }

      // Step 2: Get CSRF token from Auth.js
      const csrfRes = await fetch(apiUrl('/api/auth/csrf'));
      const { csrfToken } = await csrfRes.json();

      // Step 3: POST directly to Auth.js callback (bypasses signIn basePath issues)
      // Use redirect: 'manual' — we only need the Set-Cookie from the response,
      // not the redirect target (which Auth.js points to NEXTAUTH_URL without basePath)
      await fetch(apiUrl('/api/auth/callback/admin-credentials'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
          totpCode: totpCode || '',
          json: 'true',
        }),
        redirect: 'manual',
        credentials: 'same-origin',
      });

      // Session cookie was set by the callback response — redirect to admin
      window.location.href = apiUrl('/admin');
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

            {requiresTOTP && (
              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium text-dark-brown mb-1.5">
                  TOTP Code
                </label>
                <input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors text-center text-2xl tracking-widest"
                  placeholder="000000"
                  autoFocus
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-dark-brown text-white font-medium rounded-lg hover:bg-dark-brown/90 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-taupe/60 mt-6">
          Admin accounts are managed by super administrators.
        </p>
      </div>
    </div>
  );
}
