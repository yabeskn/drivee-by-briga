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

  const handleDemoLogin = () => {
    // Set demo driver data
    localStorage.setItem('drivee_logged_in', 'true');
    localStorage.setItem('drivee_driver_id', 'drv_demo_001');
    localStorage.setItem('drivee_phone', '081234567890');
    localStorage.setItem('drivee_phone_verified', 'true');
    localStorage.setItem('drivee_name', 'Budi Santoso (Demo)');
    localStorage.setItem('drivee_email', 'demo@drifee.id');
    router.replace('/go');
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
            <span className="text-lg font-semibold text-white">Drivee</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Sign in with Google</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Use your Google account to sign in to Drivee.
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

        {/* Demo Driver */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-black text-zinc-500">or</span>
            </div>
          </div>

          <button
            onClick={handleDemoLogin}
            className="w-full mt-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Demo Driver (Quick Test)</span>
          </button>
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
