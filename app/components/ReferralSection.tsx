'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface ReferralData {
  referralCode: string;
  referralCount: number;
  invitationsSent: number;
  invitationsUsed: number;
}

interface ReferralSectionProps {
  locale: string;
}

export default function ReferralSection({ locale }: ReferralSectionProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/me/referral'))
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralUrl = data ? `${baseUrl}/${locale}/register?ref=${data.referralCode}` : '';

  const handleCopy = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!data) return null;

  return (
    <div className="mt-12 border-t border-beige pt-8">
      <h2 className="font-serif text-xl font-bold text-dark-brown">Invite a Friend</h2>
      <p className="mt-1 text-sm text-taupe">
        Share your referral link and grow the collector community.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-beige bg-white p-4 text-center">
          <p className="text-2xl font-bold text-dark-brown">{data.referralCount}</p>
          <p className="mt-1 text-xs text-taupe uppercase tracking-wide">Successful referrals</p>
        </div>
        <div className="rounded-xl border border-beige bg-white p-4 text-center">
          <p className="text-2xl font-bold text-dark-brown">{data.invitationsSent}</p>
          <p className="mt-1 text-xs text-taupe uppercase tracking-wide">Invitations sent</p>
        </div>
        <div className="rounded-xl border border-beige bg-white p-4 text-center">
          <p className="text-2xl font-bold text-dark-brown">{data.invitationsUsed}</p>
          <p className="mt-1 text-xs text-taupe uppercase tracking-wide">Invitations used</p>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-dark-brown mb-1.5">Your referral link</label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={referralUrl}
            className="flex-1 px-3 py-2.5 rounded-lg border border-beige bg-beige/30 text-sm text-dark-brown cursor-text select-all"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold/90 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 1 2-2v-8a2 2 0 0 1-2-2h-8a2 2 0 0 1-2 2v8a2 2 0 0 1 2 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-taupe">
          Anyone who registers with this link will be credited as your referral.
        </p>
      </div>
    </div>
  );
}
