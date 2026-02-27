'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

type SetupPhase = 'inactive' | 'generating' | 'verifying' | 'recovery' | 'active';

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(16).slice(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

export default function SecurityPage() {
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<SetupPhase>('inactive');
  const [secret, setSecret] = useState('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'loading') return <div className="p-8">Loading...</div>;
  if (!session?.user || session.user.userType !== 'admin') {
    redirect('/login');
  }

  const handleSetupClick = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/2fa/setup', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Setup failed');
      }

      const data = await res.json();
      setSecret(data.secret);
      setQrCodeDataURL(data.qrCodeDataURL);
      setPhase('verifying');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClick = async () => {
    if (totpCode.length !== 6 || !/^\d+$/.test(totpCode)) {
      setError('TOTP must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token: totpCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Verification failed');
      }

      setPhase('recovery');
      setTotpEnabled(true);
      setTotpCode('');
      setRecoveryCodes(generateRecoveryCodes());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableClick = async () => {
    if (!window.confirm('Are you sure you want to disable 2FA?')) return;

    const code = prompt('Enter your current TOTP code to disable 2FA:');
    if (!code) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Disable failed');
      }

      setPhase('inactive');
      setTotpEnabled(false);
      setQrCodeDataURL('');
      setRecoveryCodes([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Security Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication (2FA)</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {phase === 'inactive' && !totpEnabled && (
          <div>
            <p className="text-gray-600 mb-4">
              Enable two-factor authentication to enhance your account security.
            </p>
            <button
              onClick={handleSetupClick}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          </div>
        )}

        {phase === 'verifying' && (
          <div>
            <p className="text-gray-600 mb-4">
              Scan this QR code with your authenticator app:
            </p>
            {qrCodeDataURL && (
              <div className="mb-4 flex justify-center">
                <img src={qrCodeDataURL} alt="TOTP QR Code" className="w-64 h-64" />
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Enter the 6-digit code from your authenticator app:
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-3 py-2 border rounded text-center text-2xl tracking-widest"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleVerifyClick}
              disabled={loading || totpCode.length !== 6}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        )}

        {phase === 'recovery' && (
          <div>
            <p className="text-gray-600 mb-4">
              ✓ 2FA enabled successfully! Save your recovery codes in a secure location.
              You can use these to regain access if you lose your authenticator device.
            </p>
            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((code, idx) => (
                  <div key={idx}>{code}</div>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                const text = recoveryCodes.join('\n');
                navigator.clipboard.writeText(text);
                alert('Recovery codes copied to clipboard');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-2"
            >
              Copy Codes
            </button>
            <button
              onClick={() => setPhase('active')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        )}

        {(phase === 'active' || totpEnabled) && (
          <div>
            <p className="text-green-600 font-semibold mb-4">✓ 2FA is enabled</p>
            <button
              onClick={handleDisableClick}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
