'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface TwoFactorSetupProps {
  totpEnabled: boolean;
}

type SetupStep = 'idle' | 'scanning' | 'verifying' | 'done';
type DisableStep = 'idle' | 'confirming';

export default function TwoFactorSetup({ totpEnabled }: TwoFactorSetupProps) {
  const router = useRouter();

  // — Enable flow —
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null);
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [enableToken, setEnableToken] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // — Disable flow —
  const [disableStep, setDisableStep] = useState<DisableStep>('idle');
  const [disableToken, setDisableToken] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Step 1: fetch secret + QR code from server (nothing saved yet)
  const handleStartSetup = async () => {
    setSetupLoading(true);
    setSetupError(null);

    const res = await fetch('/api/admin/2fa/setup', { method: 'POST' });
    const data = await res.json();
    setSetupLoading(false);

    if (!res.ok) {
      setSetupError(data.error ?? 'Failed to start 2FA setup.');
      return;
    }

    setQrCodeDataURL(data.qrCodeDataURL);
    setPendingSecret(data.secret);
    setSetupStep('scanning');
  };

  // Step 2: verify the code and enable 2FA
  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSecret) return;

    setSetupLoading(true);
    setSetupError(null);

    const res = await fetch('/api/admin/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: pendingSecret, token: enableToken }),
    });
    const data = await res.json();
    setSetupLoading(false);

    if (!res.ok) {
      setSetupError(data.error ?? 'Failed to enable 2FA.');
      return;
    }

    setSetupStep('done');
    setEnableToken('');
    setPendingSecret(null);
    setQrCodeDataURL(null);
    router.refresh();
  };

  const handleCancelSetup = () => {
    setSetupStep('idle');
    setSetupError(null);
    setEnableToken('');
    setPendingSecret(null);
    setQrCodeDataURL(null);
  };

  // Disable flow
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableLoading(true);
    setDisableError(null);

    const res = await fetch('/api/admin/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: disableToken }),
    });
    const data = await res.json();
    setDisableLoading(false);

    if (!res.ok) {
      setDisableError(data.error ?? 'Failed to disable 2FA.');
      return;
    }

    setDisableStep('idle');
    setDisableToken('');
    router.refresh();
  };

  const handleCancelDisable = () => {
    setDisableStep('idle');
    setDisableError(null);
    setDisableToken('');
  };

  return (
    <div className="bg-white rounded-xl border border-beige p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-dark-brown">Two-Factor Authentication</h2>
          <p className="text-xs text-taupe mt-0.5">
            Add an extra layer of security using a TOTP authenticator app.
          </p>
        </div>
        {totpEnabled ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-taupe">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
            Not configured
          </span>
        )}
      </div>

      {/* — Enabled: show disable option — */}
      {totpEnabled && disableStep === 'idle' && (
        <div className="flex items-center justify-between pt-3 border-t border-beige">
          <p className="text-sm text-dark-brown">
            2FA is protecting your account. Use your authenticator app when signing in.
          </p>
          <button
            onClick={() => setDisableStep('confirming')}
            className="ml-4 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors shrink-0"
          >
            Disable 2FA
          </button>
        </div>
      )}

      {totpEnabled && disableStep === 'confirming' && (
        <form onSubmit={handleDisable} className="pt-3 border-t border-beige space-y-3">
          <p className="text-sm text-dark-brown">
            Enter the 6-digit code from your authenticator app to confirm disabling 2FA.
          </p>
          {disableError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {disableError}
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-taupe uppercase mb-1">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none font-mono tracking-widest"
              />
            </div>
            <button
              type="submit"
              disabled={disableLoading || disableToken.length !== 6}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {disableLoading ? 'Disabling...' : 'Confirm Disable'}
            </button>
            <button
              type="button"
              onClick={handleCancelDisable}
              className="px-4 py-2 text-sm font-medium border border-beige text-taupe rounded-lg hover:text-dark-brown transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* — Not enabled: setup flow — */}
      {!totpEnabled && setupStep === 'idle' && (
        <div className="pt-3 border-t border-beige">
          <p className="text-sm text-taupe mb-3">
            Use an authenticator app such as Google Authenticator, Authy, or 1Password to generate
            time-based codes.
          </p>
          <button
            onClick={handleStartSetup}
            disabled={setupLoading}
            className="px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {setupLoading ? 'Generating...' : 'Set Up 2FA'}
          </button>
          {setupError && (
            <p className="mt-2 text-sm text-red-600">{setupError}</p>
          )}
        </div>
      )}

      {!totpEnabled && setupStep === 'scanning' && (
        <div className="pt-3 border-t border-beige space-y-4">
          <div>
            <p className="text-sm font-medium text-dark-brown mb-1">
              Step 1 — Scan this QR code with your authenticator app
            </p>
            <p className="text-xs text-taupe mb-3">
              Open your authenticator app and scan the QR code below. If you cannot scan, enter the
              secret key manually.
            </p>
          </div>

          {qrCodeDataURL && (
            <div className="flex flex-col items-start gap-3">
              <div className="border-2 border-beige rounded-xl p-2 bg-white inline-block">
                <Image
                  src={qrCodeDataURL}
                  alt="2FA QR Code"
                  width={192}
                  height={192}
                  className="block"
                  unoptimized
                />
              </div>
              {pendingSecret && (
                <div className="w-full">
                  <p className="text-xs font-semibold text-taupe uppercase mb-1">
                    Manual entry key
                  </p>
                  <code className="block text-xs font-mono bg-gray-50 border border-beige rounded-lg px-3 py-2 text-dark-brown break-all select-all">
                    {pendingSecret}
                  </code>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleEnable} className="space-y-3">
            <div>
              <p className="text-sm font-medium text-dark-brown mb-1">
                Step 2 — Enter the 6-digit code to confirm
              </p>
              {setupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-2">
                  {setupError}
                </div>
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-taupe uppercase mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={enableToken}
                    onChange={(e) => setEnableToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none font-mono tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={setupLoading || enableToken.length !== 6}
                  className="px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 shrink-0"
                >
                  {setupLoading ? 'Verifying...' : 'Enable 2FA'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSetup}
                  className="px-4 py-2 text-sm font-medium border border-beige text-taupe rounded-lg hover:text-dark-brown transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {!totpEnabled && setupStep === 'done' && (
        <div className="pt-3 border-t border-beige">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            2FA enabled successfully. Your account is now protected.
          </div>
        </div>
      )}
    </div>
  );
}
