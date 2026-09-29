'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SessionProvider, useSession } from 'next-auth/react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';

function LoginContent() {
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/go');
    }
  }, [status, router]);

  const handleSendVerification = async () => {
    if (!phone) return;
    setIsSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setSendResult({
        success: data.success,
        message: data.message || data.error,
      });
    } catch {
      setSendResult({ success: false, message: 'Network error' });
    } finally {
      setIsSending(false);
    }
  };



  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-5 h-5">
                <rect width="512" height="512" rx="128" fill="#000000"/>
                <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" stroke-width="12"/>
                <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#34d399"/>
                <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round"/>
                <path d="M380 380 Q400 360 380 340 Q360 360 380 380" fill="#10b981"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Drifee</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Sign in with Google</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Use your Google account to sign in to Drifee.
          </p>
          <GoogleSignInButton />
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Verify Phone Number</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Enter your WhatsApp number to receive a verification link.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxx"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleSendVerification}
              disabled={!phone || isSending}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
            >
              {isSending ? 'Sending...' : 'Send Verification Link'}
            </button>

            {sendResult && (
              <div className={`p-3 rounded-lg text-sm ${sendResult.success ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                {sendResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <LanguageProvider>
      <SessionProvider>
        <LoginContent />
      </SessionProvider>
    </LanguageProvider>
  );
}
