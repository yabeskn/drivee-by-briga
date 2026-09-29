'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function getDeviceId(): string {
  let deviceId = localStorage.getItem('drivee_device_id');
  if (!deviceId) {
    deviceId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem('drivee_device_id', deviceId);
  }
  return deviceId;
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'expired'>('verifying');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('failed');
      setError('No token provided');
      return;
    }

    const verify = async () => {
      try {
        const deviceId = getDeviceId();
        const res = await fetch(`/api/verify-phone?token=${token}&deviceId=${deviceId}`);
        const data = await res.json();

        if (data.success) {
          setStatus('success');
          setPhone(data.data.phone);
          localStorage.setItem('drivee_phone_verified', 'true');
          localStorage.setItem('drivee_phone', data.data.phone);
        } else if (res.status === 410) {
          setStatus('expired');
          setError(data.error);
        } else {
          setStatus('failed');
          setError(data.error || 'Verification failed');
        }
      } catch {
        setStatus('failed');
        setError('Network error');
      }
    };

    verify();
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Verifying...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Phone Verified!</h2>
          <p className="text-zinc-400 mb-6">
            Your phone number ({phone}) has been verified successfully.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Link Expired</h2>
          <p className="text-zinc-400 mb-2">{error}</p>
          <p className="text-zinc-500 text-sm mb-6">
            This verification link has expired. Please request a new one.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Verification Failed</h2>
        <p className="text-zinc-400 mb-2">{error}</p>
        <p className="text-zinc-500 text-sm mb-6">
          The verification link is invalid or has been used. Please request a new one.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
