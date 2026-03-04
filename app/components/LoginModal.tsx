'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { apiUrl } from '@/app/lib/utils';
import { useLocale } from '@/app/lib/LocaleContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export default function LoginModal({ isOpen, onClose, onAuthenticated }: LoginModalProps) {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setMagicLinkSent(false);
    setShowPassword(false);
    setPassword('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
        setError(data.error || t.loginErrorMagicLink);
      }
    } catch {
      setError(t.loginErrorGeneric);
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
        setError(t.loginErrorInvalidCredentials);
      } else {
        onClose();
        onAuthenticated();
      }
    } catch {
      setError(t.loginErrorGeneric);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-brown/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-2xl leading-none text-taupe hover:text-dark-brown"
            aria-label={t.cancelBid}
          >
            &times;
          </button>
        </div>

        {magicLinkSent ? (
          <div className="py-4 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-dark-brown mb-2">{t.loginCheckEmail}</h2>
            <p className="text-sm text-taupe mb-4">
              {t.loginMagicLinkSent} <strong className="text-dark-brown">{email}</strong>. {t.loginMagicLinkClick}
            </p>
            <button
              onClick={() => setMagicLinkSent(false)}
              className="text-sm text-gold hover:underline"
            >
              {t.loginDifferentEmail}
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="font-serif text-xl font-bold text-dark-brown">{t.loginTitle}</h2>
            </div>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="login-modal-email" className="block text-sm font-medium text-dark-brown mb-1.5">
                  {t.loginEmail}
                </label>
                <input
                  id="login-modal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                  placeholder={t.loginEmailPlaceholder}
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
                    {t.loginSending}
                  </span>
                ) : (
                  t.loginSendMagicLink
                )}
              </button>
            </form>

            {/* Password divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-beige" />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-taupe hover:text-gold transition-colors"
              >
                {showPassword ? t.loginHidePassword : t.loginOrPassword}
              </button>
              <div className="flex-1 h-px bg-beige" />
            </div>

            {/* Password form */}
            {showPassword && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-modal-password" className="block text-sm font-medium text-dark-brown mb-1.5">
                    {t.loginPassword}
                  </label>
                  <input
                    id="login-modal-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown placeholder-taupe/50 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                    placeholder={t.loginPasswordPlaceholder}
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
                      {t.loginSigningIn}
                    </span>
                  ) : (
                    t.loginSignIn
                  )}
                </button>
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

            <p className="text-center text-sm text-taupe mt-5">
              {t.loginNoAccount}{' '}
              <a href={`/${locale}/register`} className="text-gold hover:underline font-medium">
                {t.loginRegister}
              </a>
            </p>
          </>
        )}
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
