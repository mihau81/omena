'use client';

import { useState, useEffect, useRef } from 'react';
import { useBidding } from '../lib/BiddingContext';
import { useLocale } from '../lib/LocaleContext';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: () => void;
}

export default function RegistrationModal({
  isOpen,
  onClose,
  onRegistered,
}: RegistrationModalProps) {
  const { register, registration } = useBidding();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      nameRef.current?.focus();
      setShowSuccess(false);
      setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t.registerName;
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email))
      errs.email = t.registerEmail;
    if (!phone.trim()) errs.phone = t.registerPhone;
    if (!acceptTerms) errs.terms = t.registerTerms;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    register(name.trim(), email.trim(), phone.trim());
    setShowSuccess(true);
    setTimeout(() => {
      onClose();
      onRegistered();
    }, 2000);
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Rejestracja licytanta"
      >
        {showSuccess && registration ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl text-green-600">&#10003;</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-dark-brown">
              {t.registerSuccess}
            </h2>
            <p className="mt-2 text-taupe">
              {t.paddleNumber}:{' '}
              <span className="font-serif text-xl font-bold text-gold">
                #{registration.paddleNumber}
              </span>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-dark-brown">
                {t.registerTitle}
              </h2>
              <button
                onClick={onClose}
                className="text-2xl leading-none text-taupe hover:text-dark-brown"
                aria-label={t.cancelBid}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-dark-brown">
                  {t.registerName}
                </label>
                <input
                  ref={nameRef}
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-beige px-3 py-2 text-dark-brown focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-dark-brown">
                  {t.registerEmail}
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-beige px-3 py-2 text-dark-brown focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-dark-brown">
                  {t.registerPhone}
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-beige px-3 py-2 text-dark-brown focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <input
                  id="reg-terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-beige text-gold accent-gold"
                />
                <label htmlFor="reg-terms" className="text-sm text-taupe">
                  {t.registerTerms}
                </label>
              </div>
              {errors.terms && (
                <p className="text-xs text-red-600">{errors.terms}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-gold py-3 font-medium text-white transition-colors hover:bg-gold-dark"
              >
                {t.registerSubmit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
