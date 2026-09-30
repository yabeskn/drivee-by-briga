'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Coins, TrendingUp, ShoppingBag, RefreshCw, AlertCircle } from 'lucide-react';

export interface BrigaCoinWidgetProps {
  userId: string;
  apiUrl?: string;
  apiKey?: string;
  showDetails?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

interface BalanceData {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

export function BrigaCoinWidget({
  userId,
  apiUrl = '',
  apiKey,
  showDetails = true,
  theme = 'dark',
  className = '',
}: BrigaCoinWidgetProps) {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    try {
      setIsRefreshing(true);
      setError(null);

      const endpoint = `${apiUrl}/api/brigacoin/v1/balance/${encodeURIComponent(userId)}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(endpoint, { headers });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || 'Gagal memuat saldo');
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error koneksi');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, apiUrl, apiKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const isDark = theme === 'dark';
  const balance = data?.balance ?? 0;
  const idrEquivalent = balance * 5000;

  return (
    <div
      className={`rounded-2xl p-5 border transition-all duration-300 shadow-lg ${
        isDark
          ? 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-emerald-950/20'
          : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-md shadow-emerald-500/20">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Unified Loyalty
            </h4>
            <h3 className="text-sm font-bold">BrigaCoin Balance</h3>
          </div>
        </div>

        <button
          onClick={fetchBalance}
          disabled={isRefreshing}
          title="Segarkan Saldo"
          className={`p-1.5 rounded-lg border transition-all ${
            isDark
              ? 'border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              : 'border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="py-4">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-slate-800 rounded w-28"></div>
            <div className="h-4 bg-slate-800 rounded w-36"></div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-rose-400 text-sm py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                {balance.toLocaleString('id-ID')}
              </span>
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                BRC
              </span>
            </div>

            <p className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ≈ Rp {idrEquivalent.toLocaleString('id-ID')} IDR
              <span className="ml-1 text-[10px] text-slate-500">(1 BRC = Rp 5.000)</span>
            </p>
          </div>
        )}
      </div>

      {/* Additional Stats */}
      {showDetails && !loading && !error && data && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/40 text-xs">
          <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-semibold text-[11px]">Total Didapat</span>
            </div>
            <p className="font-bold text-sm">
              +{data.total_earned.toLocaleString('id-ID')} BRC
            </p>
          </div>

          <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-semibold text-[11px]">Dibelanjakan</span>
            </div>
            <p className="font-bold text-sm">
              -{data.total_spent.toLocaleString('id-ID')} BRC
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
export default BrigaCoinWidget;
