'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/utils';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();
  const qrCode = searchParams.get('qr');
  const invitationToken = searchParams.get('invitation');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Determine context
  const context = qrCode ? 'qr' : invitationToken ? 'invitation' : 'direct';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let url = apiUrl('/api/auth/register');
      let body: Record<string, string | undefined> = { email, name, phone: phone || undefined, password: password || undefined };

      if (context === 'qr') {
        url = apiUrl('/api/auth/register/qr');
        body.qrCode = qrCode!;
      } else if (context === 'invitation') {
        url = apiUrl('/api/auth/register/invitation');
        body.invitationToken = invitationToken!;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
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
            <p className="text-sm text-taupe">
              We sent a verification link to <strong className="text-dark-brown">{email}</strong>. Click the link to verify your email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-dark-brown tracking-wide">OMENA</h1>
          <p className="text-sm text-taupe mt-1">Create your account</p>
        </div>

        {/* Context banner */}
        {context === 'qr' && (
          <div className="mb-4 p-3 rounded-lg bg-gold/10 border border-gold/30 text-sm text-dark-brown">
            Registration via event QR code
          </div>
        )}
        {context === 'invitation' && (
          <div className="mb-4 p-3 rounded-lg bg-gold/10 border border-gold/30 text-sm text-dark-brown">
            You&apos;ve been invited to Omena
          </div>
        )}

        {/* Register card */}
        <div className="bg-white rounded-xl border border-beige shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark-brown mb-6">Register</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-dark-brown mb-1.5">
                Full Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-dark-brown mb-1.5">
                Email *
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-dark-brown mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="+48..."
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-dark-brown mb-1.5">
                Password <span className="text-taupe font-normal">(optional)</span>
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="Min 8 characters (or use magic link later)"
              />
            </div>

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
              className="w-full py-2.5 px-4 bg-gold text-white font-medium rounded-lg hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-taupe mt-6">
          Already have an account?{' '}
          <Link href={`/${locale}/login`} className="text-gold hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
