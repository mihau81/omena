'use client';

import { useState, useEffect } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe as StripeClient } from '@stripe/stripe-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentFormProps {
  invoiceId: string;
  invoiceNumber: string;
  lotTitle: string;
  lotNumber: number;
  auctionTitle: string;
  hammerPrice: number;
  buyersPremium: number;
  totalAmount: number;
  currency: string;
  stripePublishableKey: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Inner checkout form (mounted inside <Elements>) ─────────────────────────

function CheckoutForm({
  invoiceId,
  clientSecret,
  totalAmount,
  onSuccess,
}: {
  invoiceId: string;
  clientSecret: string;
  totalAmount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMessage(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage('Card input not found. Please refresh and try again.');
      setProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else {
      setErrorMessage('Unexpected payment status. Please contact support.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-dark-brown mb-2">
          Card details
        </label>
        <div className="px-3 py-3 border border-beige rounded-lg bg-white focus-within:ring-2 focus-within:ring-gold/30 focus-within:border-gold transition-colors">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '15px',
                  color: '#2c1a0e',
                  fontFamily: 'system-ui, sans-serif',
                  '::placeholder': { color: '#9e8c7a' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3 px-6 bg-gold text-white font-semibold rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {processing ? 'Processing payment…' : `Pay ${formatPLN(totalAmount)}`}
      </button>

      <p className="text-center text-xs text-taupe">
        Secured by{' '}
        <span className="font-semibold">Stripe</span>
        {' '}&mdash; your card details are never stored on our servers.
      </p>
    </form>
  );
}

// ─── Main PaymentForm component ───────────────────────────────────────────────

export default function PaymentForm({
  invoiceId,
  invoiceNumber,
  lotTitle,
  lotNumber,
  auctionTitle,
  hammerPrice,
  buyersPremium,
  totalAmount,
  currency,
  stripePublishableKey,
}: PaymentFormProps) {
  const [stripePromise, setStripePromise] = useState<Promise<StripeClient | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    setStripePromise(loadStripe(stripePublishableKey));
  }, [stripePublishableKey]);

  useEffect(() => {
    async function fetchIntent() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/omena/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Failed to initialise payment.');
          return;
        }
        setClientSecret(data.clientSecret);
      } catch {
        setError('Network error. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchIntent();
  }, [invoiceId]);

  if (succeeded) {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h2 className="text-xl font-serif font-bold text-dark-brown">Payment successful!</h2>
        <p className="text-taupe text-sm">
          Invoice <span className="font-mono font-semibold">{invoiceNumber}</span> has been paid.
        </p>
        <p className="text-taupe text-sm">
          You will receive a confirmation email shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice summary */}
      <div className="bg-cream/40 rounded-xl border border-beige p-5 space-y-3">
        <h2 className="text-xs font-semibold text-taupe uppercase tracking-wider">Invoice Summary</h2>

        <div>
          <p className="font-mono text-sm font-bold text-dark-brown">{invoiceNumber}</p>
          <p className="text-sm text-taupe mt-0.5">{auctionTitle}</p>
        </div>

        <div className="pt-2 border-t border-beige space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-taupe">
              Lot #{lotNumber} &mdash; {lotTitle.length > 50 ? lotTitle.slice(0, 50) + '…' : lotTitle}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-taupe">Hammer price</span>
            <span className="text-dark-brown font-medium">{formatPLN(hammerPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-taupe">Buyer&apos;s premium</span>
            <span className="text-dark-brown">{formatPLN(buyersPremium)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-beige/70 pt-2 mt-1">
            <span className="text-dark-brown">Total due</span>
            <span className="text-dark-brown text-base">{formatPLN(totalAmount)}</span>
          </div>
          {currency !== 'PLN' && (
            <p className="text-xs text-taupe text-right">{currency}</p>
          )}
        </div>
      </div>

      {/* Payment form */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-taupe text-sm gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Initialising secure payment…
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      ) : clientSecret && stripePromise ? (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, locale: 'pl' }}
        >
          <CheckoutForm
            invoiceId={invoiceId}
            clientSecret={clientSecret}
            totalAmount={totalAmount}
            onSuccess={() => setSucceeded(true)}
          />
        </Elements>
      ) : null}
    </div>
  );
}
