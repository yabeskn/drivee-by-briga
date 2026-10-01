'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  Sparkles,
  Ticket,
  TrendingDown,
  Building2,
  Wallet,
  Car,
  RefreshCw,
  LogOut,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { signOut } from '@/lib/supabase/auth';
import type { BoardingPass } from '@/types/telematics';

interface CommuterSummary {
  userId: string;
  email: string;
  isCorporate: boolean;
  companyName: string;
  balanceBrc: number;
  balanceIdr: number;
  metrics: {
    totalTrips: number;
    totalDistanceKm: number;
    totalCo2SavedKg: number;
    totalBrcUsed: number;
    totalSavingsIdr: number;
  };
}

const PRESET_CORRIDORS = [
  { id: 'c1', name: 'Lippo Cikarang → GIIC Deltamas', distanceKm: 16.4, fareIdr: 50000 },
  { id: 'c2', name: 'Grand Wisata → Kawasan MM2100', distanceKm: 12.8, fareIdr: 40000 },
  { id: 'c3', name: 'Jababeka 1 → Stasiun Cikarang', distanceKm: 9.2, fareIdr: 30000 },
  { id: 'c4', name: 'Cikarang Dry Port → Bandara Soetta', distanceKm: 61.8, fareIdr: 250000 },
];

export default function CommuterDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [summary, setSummary] = useState<CommuterSummary | null>(null);
  const [boardingPass, setBoardingPass] = useState<BoardingPass | null>(null);

  // Fare calculator state
  const [selectedCorridor, setSelectedCorridor] = useState(PRESET_CORRIDORS[0]);
  const [coinsToSpend, setCoinsToSpend] = useState<number>(5);
  const [isGeneratingPass, setIsGeneratingPass] = useState(false);

  // Voucher claim state
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch or create user boarding data
  const loadDashboardData = useCallback(async (userId: string, email: string) => {
    try {
      const res = await fetch(`/api/commuter/boarding?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.success) {
        setSummary(data.summary);
        if (data.activePass) {
          setBoardingPass(data.activePass);
          setCoinsToSpend(data.activePass.discountBrcSelected);
        }
      }
    } catch (err) {
      console.error('Failed to load commuter data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/login?next=/commuter');
        return;
      }
      const u = {
        id: session.user.id,
        email: session.user.email || 'commuter@briga.id',
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Karyawan Komuter',
      };
      setUser(u);
      loadDashboardData(u.id, u.email);
    });
  }, [router, loadDashboardData]);

  // Handle generating/refreshing boarding pass
  const handleGenerateBoardingPass = async () => {
    if (!user) return;
    setIsGeneratingPass(true);
    try {
      const res = await fetch('/api/commuter/boarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          passengerEmail: user.email,
          passengerName: user.name,
          discountBrcSelected: coinsToSpend,
          estimatedFareIdr: selectedCorridor.fareIdr,
          routeCorridor: selectedCorridor.name,
          companyName: summary?.companyName,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setBoardingPass(json.data);
      }
    } catch (err) {
      console.error('Failed to generate boarding pass:', err);
    } finally {
      setIsGeneratingPass(false);
    }
  };

  // Handle claiming corporate voucher
  const handleClaimVoucher = async () => {
    if (!user || !voucherCodeInput.trim()) return;
    setIsClaiming(true);
    setClaimMessage(null);

    try {
      const res = await fetch('/api/corporate/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          voucherCode: voucherCodeInput.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setClaimMessage({
          type: 'success',
          text: `Berhasil mengklaim ${json.claimedAmount} BRC subsidi komuter dari ${json.companyName || 'Perusahaan Mitra'}!`,
        });
        setVoucherCodeInput('');
        loadDashboardData(user.id, user.email);
      } else {
        setClaimMessage({
          type: 'error',
          text: json.error || 'Voucher tidak valid atau sudah kedaluwarsa.',
        });
      }
    } catch {
      setClaimMessage({ type: 'error', text: 'Gagal menghubungi server untuk klaim voucher.' });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  // Calculated values
  const availableBrc = summary?.balanceBrc ?? 0;
  const maxCoinsUsable = Math.min(availableBrc, Math.floor(selectedCorridor.fareIdr / 5000));
  const effectiveDiscountIdr = Math.min(coinsToSpend * 5000, selectedCorridor.fareIdr);
  const netFareIdr = Math.max(0, selectedCorridor.fareIdr - effectiveDiscountIdr);
  const estimatedCo2Saved = Number((selectedCorridor.distanceKm * 0.137).toFixed(2));

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Memuat Dashboard Komuter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Navbar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">
                  drifee<span className="text-emerald-400">.commuter</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  PASSENGER PORTAL
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Layanan Komuter Hijau Armada Mobil Listrik (EV) & ESG Scope 3
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/go"
              className="text-xs px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-200 font-medium transition-colors flex items-center gap-1.5"
            >
              <Car className="w-3.5 h-3.5 text-amber-400" />
              <span>Mode Pengemudi</span>
            </Link>

            <Link
              href="/rewards"
              className="text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors"
            >
              Katalog Reward
            </Link>

            <button
              onClick={handleSignOut}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-colors"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* User & Corporate Affiliation Card */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-800/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{user?.name}</span>
              <span className="text-xs text-zinc-400">({user?.email})</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-medium">
                {summary?.companyName || 'Pengguna Komuter Umum'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                {summary?.isCorporate ? 'Mitra ESG Terverifikasi' : 'Retail'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-4 py-2.5">
            <div>
              <div className="text-[11px] text-zinc-400">Saldo Subsidi BrigaCoin</div>
              <div className="text-xl font-bold font-mono text-amber-400 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span>{availableBrc.toLocaleString()} BRC</span>
              </div>
            </div>
            <div className="text-right border-l border-zinc-800 pl-4">
              <div className="text-[11px] text-zinc-400">Nilai Subsidi</div>
              <div className="text-sm font-bold font-mono text-emerald-400">
                Rp {(availableBrc * 5000).toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>

        {/* Claim Voucher Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Punya kode voucher subsidi komuter dari HR/Perusahaan?</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={voucherCodeInput}
              onChange={(e) => setVoucherCodeInput(e.target.value)}
              placeholder="Contoh: CORP-DEMO-XYZ"
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono uppercase text-xs focus:outline-none focus:border-emerald-500 w-full sm:w-44"
            />
            <button
              onClick={handleClaimVoucher}
              disabled={isClaiming || !voucherCodeInput.trim()}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {isClaiming ? 'Mengecek...' : 'Klaim'}
            </button>
          </div>
        </div>

        {claimMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              claimMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                : 'bg-red-950/80 border border-red-800 text-red-300'
            }`}
          >
            {claimMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{claimMessage.text}</span>
          </div>
        )}

        {/* Main Grid: Live Boarding Pass & Fare Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Live Boarding Pass (6 Cols) */}
          <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">Boarding Pass Komuter EV</h2>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                  boardingPass?.status === 'boarded'
                    ? 'bg-blue-950/80 text-blue-400 border-blue-800'
                    : 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                }`}>
                  {boardingPass?.status === 'boarded' ? 'Sedang di Perjalanan' : 'Siap Dijemput'}
                </span>
              </div>

              {boardingPass ? (
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 text-center space-y-4">
                  {/* Dynamic Visual QR Code */}
                  <div className="inline-block p-3 bg-white rounded-xl shadow-lg shadow-emerald-950/20">
                    <svg viewBox="0 0 100 100" className="w-36 h-36 mx-auto">
                      {/* Corner target patterns */}
                      <rect x="10" y="10" width="24" height="24" fill="#000" />
                      <rect x="14" y="14" width="16" height="16" fill="#fff" />
                      <rect x="18" y="18" width="8" height="8" fill="#000" />

                      <rect x="66" y="10" width="24" height="24" fill="#000" />
                      <rect x="70" y="14" width="16" height="16" fill="#fff" />
                      <rect x="74" y="18" width="8" height="8" fill="#000" />

                      <rect x="10" y="66" width="24" height="24" fill="#000" />
                      <rect x="14" y="70" width="16" height="16" fill="#fff" />
                      <rect x="18" y="74" width="8" height="8" fill="#000" />

                      {/* Data Pattern Representation */}
                      <rect x="42" y="12" width="6" height="6" fill="#059669" />
                      <rect x="52" y="18" width="6" height="6" fill="#000" />
                      <rect x="42" y="28" width="6" height="6" fill="#000" />
                      <rect x="42" y="44" width="16" height="16" rx="4" fill="#10b981" />
                      <circle cx="50" cy="52" r="4" fill="#000" />
                      <rect x="18" y="42" width="6" height="6" fill="#000" />
                      <rect x="28" y="52" width="6" height="6" fill="#059669" />
                      <rect x="72" y="42" width="6" height="6" fill="#000" />
                      <rect x="80" y="52" width="6" height="6" fill="#000" />
                      <rect x="42" y="72" width="6" height="6" fill="#000" />
                      <rect x="54" y="80" width="6" height="6" fill="#059669" />
                      <rect x="72" y="72" width="6" height="6" fill="#000" />
                    </svg>
                  </div>

                  {/* 6-Digit Boarding Code */}
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Kode Penjemputan Driver</div>
                    <div className="text-3xl font-extrabold font-mono text-emerald-400 tracking-wider mt-1">
                      {boardingPass.code}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Tunjukkan kode atau QR ini ke pengemudi mobil EV saat naik
                    </p>
                  </div>

                  {/* Pass Details */}
                  <div className="border-t border-zinc-800/80 pt-3 text-left space-y-1.5 text-xs text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Rute:</span>
                      <span className="font-medium text-white truncate max-w-[220px]">{boardingPass.routeCorridor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subsidi Digunakan:</span>
                      <span className="font-mono text-amber-400">
                        {boardingPass.discountBrcSelected} BRC (Rp {(boardingPass.discountBrcSelected * 5000).toLocaleString('id-ID')})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Estimasi Tarif Bersih:</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        Rp {Math.max(0, boardingPass.estimatedFareIdr - (boardingPass.discountBrcSelected * 5000)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-8 text-center space-y-3">
                  <Ticket className="w-12 h-12 text-zinc-600 mx-auto" />
                  <h3 className="text-sm font-semibold text-zinc-300">Belum Ada Tiket Boarding Aktif</h3>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                    Pilih rute dan alokasikan subsidi koin Anda pada panel di samping untuk membuat boarding pass baru.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <button
                onClick={handleGenerateBoardingPass}
                disabled={isGeneratingPass}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-zinc-950 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-950/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPass ? 'animate-spin' : ''}`} />
                <span>{boardingPass ? 'Perbarui Tiket Boarding Pass' : 'Generate Boarding Pass Baru'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Commute Fare & BRC Subsidy Calculator (6 Cols) */}
          <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">Kalkulator Komuter Hijau</h2>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">1 BRC = Rp 5.000</span>
              </div>

              {/* Corridor Selector */}
              <div className="space-y-2 mb-5">
                <label className="text-xs text-zinc-400 font-medium">Pilih Koridor Perjalanan EV:</label>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_CORRIDORS.map((corridor) => (
                    <button
                      key={corridor.id}
                      onClick={() => {
                        setSelectedCorridor(corridor);
                        setCoinsToSpend(Math.min(coinsToSpend, Math.floor(corridor.fareIdr / 5000)));
                      }}
                      className={`p-3 rounded-xl text-left border transition-all text-xs flex items-center justify-between ${
                        selectedCorridor.id === corridor.id
                          ? 'bg-emerald-950/30 border-emerald-500/80 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-zinc-200">{corridor.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{corridor.distanceKm} km</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-semibold text-zinc-300">Rp {corridor.fareIdr.toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-emerald-400">ΔCO₂: {(corridor.distanceKm * 0.137).toFixed(1)} kg</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* BRC Subsidy Slider */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 space-y-3 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Gunakan Subsidi BrigaCoin:</span>
                  <span className="font-bold font-mono text-amber-400">
                    {coinsToSpend} BRC (Rp {(coinsToSpend * 5000).toLocaleString('id-ID')})
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={Math.max(1, maxCoinsUsable)}
                  value={coinsToSpend}
                  onChange={(e) => setCoinsToSpend(Number(e.target.value))}
                  disabled={availableBrc === 0}
                  className="w-full accent-emerald-500 bg-zinc-800 rounded-lg cursor-pointer h-2"
                />

                <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                  <span>0 BRC (Tanpa Diskon)</span>
                  <span>Maks: {maxCoinsUsable} BRC</span>
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="border border-zinc-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Tarif Normal:</span>
                  <span className="font-mono line-through text-zinc-500">
                    Rp {selectedCorridor.fareIdr.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>Potongan Subsidi Korporat:</span>
                  <span className="font-mono">- Rp {effectiveDiscountIdr.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-zinc-800 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-white">Tarif Bersih Dibayar:</span>
                  <span className="font-mono text-emerald-400">
                    Rp {netFareIdr.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 flex items-center justify-between pt-1">
                  <span>Emisi CO₂ Dihemat:</span>
                  <span className="font-mono text-emerald-400">{estimatedCo2Saved} kg CO₂</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={handleGenerateBoardingPass}
                disabled={isGeneratingPass}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Terapkan Alokasi ke Tiket Penjemputan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Personal Scope 3 Carbon Impact Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Trip Komuter Selesai</span>
              <Car className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {summary?.metrics.totalTrips ?? 0} <span className="text-xs font-normal text-zinc-500">trip</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Armada mobil EV terverifikasi</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Jarak Bersih EV</span>
              <TrendingDown className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {summary?.metrics.totalDistanceKm ?? 0} <span className="text-xs font-normal text-zinc-500">km</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Koridor Industri Jabodetabek</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>CO₂ Dihindari (Scope 3)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {summary?.metrics.totalCo2SavedKg ?? 0} <span className="text-xs font-normal text-zinc-500">kg</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Audit GHG Protocol Cat 7</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Total Subsidi Dinikmati</span>
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              Rp {(summary?.metrics.totalSavingsIdr ?? 0).toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Dari {summary?.metrics.totalBrcUsed ?? 0} BRC ditukar</p>
          </div>
        </div>

      </div>
    </div>
  );
}
