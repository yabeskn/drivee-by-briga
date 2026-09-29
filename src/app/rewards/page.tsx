'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

interface Reward {
  id: string;
  name: string;
  description: string;
  category: string;
  cost: number;
  stock: number;
  image: string;
  terms: string;
  type: string;
  status: string;
}

export default function RewardsPage() {
  const { t } = useLanguage();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRewards();
    fetchBalance();
  }, []);

  const fetchRewards = async () => {
    try {
      const res = await fetch('/api/rewards?userType=driver');
      const data = await res.json();
      if (data.success) {
        setRewards(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const driverId = localStorage.getItem('drivee_driver_id') || 'drv_default';
      const res = await fetch(`/api/brigacoin/balance?driverId=${driverId}`);
      const data = await res.json();
      if (data.success) {
        setBalance(data.data.balance.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId);
    setMessage(null);

    try {
      const driverId = localStorage.getItem('drivee_driver_id') || 'drv_default';
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, rewardId }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Redeemed: ${data.data.voucherCode}` });
        fetchBalance();
        fetchRewards();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setRedeeming(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      internal: 'bg-emerald-100 text-emerald-700',
      voucher: 'bg-blue-100 text-blue-700',
      ewallet: 'bg-purple-100 text-purple-700',
      transport: 'bg-cyan-100 text-cyan-700',
      maintenance: 'bg-orange-100 text-orange-700',
      insurance: 'bg-red-100 text-red-700',
      carbon: 'bg-green-100 text-green-700',
    };
    return colors[category] || 'bg-zinc-100 text-zinc-700';
  };

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-5 h-5">
                <rect width="512" height="512" rx="128" fill="#000000"/>
                <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" stroke-width="12"/>
                <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#10b981"/>
                <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round"/>
                <circle cx="380" cy="380" r="24" fill="#F59E0B"/>
                <text x="380" y="388" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#052e16" text-anchor="middle">$</text>
                <path d="M130 380 Q150 360 130 340 Q110 360 130 380" fill="#34d399"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Drifee</span>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Balance Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">BrigaCoin Balance</p>
              <p className="text-3xl font-bold text-amber-400">{balance} BRC</p>
              <p className="text-xs text-zinc-500 mt-1">≈ Rp {(balance * 5000).toLocaleString('id-ID')}</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Rewards Grid */}
        <h2 className="text-xl font-semibold text-white mb-4">Available Rewards</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading rewards...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div key={reward.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(reward.category)}`}>
                    {reward.category}
                  </span>
                  <span className="text-amber-400 font-bold">{reward.cost} BRC</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{reward.name}</h3>
                <p className="text-xs text-zinc-400 mb-3">{reward.description}</p>
                <p className="text-xs text-zinc-500 mb-3">{reward.terms}</p>
                <button
                  onClick={() => handleRedeem(reward.id)}
                  disabled={balance < reward.cost || redeeming === reward.id || reward.stock <= 0}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    balance >= reward.cost && reward.stock > 0
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {redeeming === reward.id
                    ? 'Processing...'
                    : reward.stock <= 0
                    ? 'Out of Stock'
                    : balance < reward.cost
                    ? 'Insufficient Balance'
                    : 'Redeem'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
