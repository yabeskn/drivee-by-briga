'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TreeDeciduous,
  Factory,
  ShieldCheck,
  TrendingDown,
  ArrowUpRight,
  Download,
  Car,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { rentalPackages } from '@/lib/hr/rental';

export default function CompanyEsgPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState('demo-corp-cikarang');
  const [activeTab, setActiveTab] = useState<'overview' | 'rentals' | 'commute'>('commute');

  // Summary Metrics
  const summary = {
    totalEmissionsAvoidedKg: 1420.5,
    scope3ReductionPercent: 68.4,
    activeEVShuttles: 4,
    totalRentalTrips: 182,
    carbonCreditsBrc: 14200,
    certifiedPeriod: 'Q3 2026',
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Top Navbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TreeDeciduous className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">briga<span className="text-emerald-400">.id</span></span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  ESG & SCOPE 3
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Corporate Mobility Carbon Accounting — Cikarang Industrial Corridor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors"
            >
              Fleet Admin
            </Link>
            <button
              onClick={() => alert('Laporan ESG resmi (PDF) telah dikirimkan ke email PIC Perusahaan.')}
              className="text-xs px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Laporan ESG</span>
            </button>
          </div>
        </div>

        {/* Highlight Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-800/40 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Sertifikasi Emisi Bersih
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Kompensasi Emisi Perjalanan Karyawan & Tamu Eksekutif
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Semua perjalanan shuttle EV rute Cikarang – Bandara Soekarno Hatta diverifikasi secara kriptografis menggunakan algoritma sensor smartphone Drifee, siap untuk pelaporan audit Scope 3 GHG Protocol.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>CO₂ Dihindari</span>
              <TrendingDown className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {summary.totalEmissionsAvoidedKg.toLocaleString()} <span className="text-sm font-normal text-zinc-400">kg</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Dibandingkan kendaraan ICE bensin</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>Reduksi Scope 3</span>
              <Factory className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {summary.scope3ReductionPercent}%
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Efisiensi mobilitas operasional</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>EV Shuttle Aktif</span>
              <Car className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {summary.activeEVShuttles} <span className="text-sm font-normal text-zinc-400">Unit</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">{summary.totalRentalTrips} trip selesai kuartal ini</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>BrigaCoins Terkumpul</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {summary.carbonCreditsBrc.toLocaleString()} <span className="text-sm font-normal text-zinc-400">BRC</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Siap untuk konversi offset kredit</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-800 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('commute')}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'commute'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🌿 Green Commute Karyawan (Scope 3)
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paket Shuttle Korporat
          </button>
          <button
            onClick={() => setActiveTab('rentals')}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'rentals'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Riwayat Rental & Emisi
          </button>
        </div>

        {/* Content based on tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rentalPackages.slice(0, 3).map((pkg) => (
              <div
                key={pkg.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      {pkg.vehicleCategory}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">{pkg.seats} Kursi</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{pkg.name} Package</h3>
                  <p className="text-xs text-zinc-400 mb-4">{pkg.description}</p>
                  
                  <div className="space-y-2 py-3 border-y border-zinc-800/60 text-xs">
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-zinc-400">Jatah Jarak</span>
                      <span className="font-mono">{pkg.distancePerDayKm} km / hari</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-zinc-400">Faktor Emisi EV</span>
                      <span className="font-mono text-emerald-400">{pkg.emissionFactor} kg/km</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-2">
                  <div className="text-lg font-bold text-white font-mono mb-3">
                    Rp {pkg.price.toLocaleString('id-ID')}
                    <span className="text-xs font-normal text-zinc-400"> / {pkg.duration}</span>
                  </div>
                  <button
                    onClick={() => alert(`Pengajuan sewa ${pkg.name} telah diterima. Tim Briga.id akan segera menghubungi Anda.`)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Pesan Shuttle EV
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rentals' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Log Emisi Terverifikasi Perjalanan Korporat</h3>
            </div>
            <div className="divide-y divide-zinc-800/60 text-xs">
              {[
                { date: '29 Sep 2026', route: 'Cikarang Dry Port → Bandara Soetta', distance: '61.8 km', vehicle: 'Hyundai Ioniq 5', avoided: '7.4 kg CO₂', status: 'VERIFIED' },
                { date: '28 Sep 2026', route: 'Kawasan MM2100 → Halim Perdanakusuma', distance: '34.2 km', vehicle: 'BYD Atto 3', avoided: '4.1 kg CO₂', status: 'VERIFIED' },
                { date: '27 Sep 2026', route: 'Jababeka II → Bandara Soetta', distance: '64.5 km', vehicle: 'Hyundai Ioniq 5', avoided: '7.7 kg CO₂', status: 'VERIFIED' },
                { date: '26 Sep 2026', route: 'GIIC Cikarang → Sudirman Jakarta', distance: '48.0 km', vehicle: 'Wuling BinguoEV', avoided: '5.8 kg CO₂', status: 'VERIFIED' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-white">{item.route}</div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                      <span>{item.date}</span>
                      <span>•</span>
                      <span>{item.vehicle}</span>
                      <span>•</span>
                      <span>{item.distance}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-mono font-medium">{item.avoided}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'commute' && (
          <div className="space-y-6">
            {/* Pool & Regulation Notice */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-400 font-bold text-sm">Corporate BrigaCoin Pool</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                    CLOSED-LOOP LOYALTY
                  </span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  2,500 <span className="text-sm text-zinc-400 font-normal">BRC (≈ Rp 12.500.000)</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Digunakan untuk subsidi potongan langsung armada <strong>Mobil Listrik (EV) Drifee</strong> (1 BRC = Rp 5.000 diskon tarif).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/rewards"
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Lihat Katalog Reward</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Scope 3 Commuting Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">Total Trip Komuter EV</div>
                <div className="text-xl font-bold text-white font-mono">148 <span className="text-xs font-normal text-zinc-500">perjalanan</span></div>
                <p className="text-[10px] text-emerald-400 mt-1">100% Armada Mobil EV</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">Jarak Bersih Ditempuh</div>
                <div className="text-xl font-bold text-white font-mono">3,842.6 <span className="text-xs font-normal text-zinc-500">km</span></div>
                <p className="text-[10px] text-zinc-500 mt-1">Koridor Industri Cikarang & Jabodetabek</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">Reduksi Emisi Scope 3</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">526.4 <span className="text-xs font-normal text-zinc-500">kg CO₂</span></div>
                <p className="text-[10px] text-zinc-500 mt-1">ΔCO₂ = 0.137 kg/km vs ICE</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">Karyawan Terdaftar</div>
                <div className="text-xl font-bold text-white font-mono">38 <span className="text-xs font-normal text-zinc-500">orang</span></div>
                <p className="text-[10px] text-zinc-500 mt-1">Via Domain @cikarang-mobility.com</p>
              </div>
            </div>

            {/* Subsidized Commute Trips List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Riwayat Perjalanan Komuter Karyawan Tersubsidi</h3>
                  <p className="text-xs text-zinc-400">Tercatat secara atomik dengan perhitungan telematika emisi POJK 51/2017</p>
                </div>
                <span className="text-xs text-zinc-400 font-mono">Scope 3 Cat 7</span>
              </div>
              <div className="divide-y divide-zinc-800/60 text-xs">
                {[
                  { employee: 'budi.santoso@cikarang-mobility.com', date: 'Hari ini, 08:15', route: 'Lippo Cikarang → GIIC Deltamas', distance: '16.4 km', evVehicle: 'Hyundai Ioniq 5', brcDiscount: '6 BRC (Rp 30.000)', co2Avoided: '2.25 kg CO₂' },
                  { employee: 'siti.aminah@cikarang-mobility.com', date: 'Hari ini, 07:45', route: 'Grand Wisata → Kawasan MM2100', distance: '12.8 km', evVehicle: 'Wuling BinguoEV', brcDiscount: '5 BRC (Rp 25.000)', co2Avoided: '1.75 kg CO₂' },
                  { employee: 'hendra.wijaya@cikarang-mobility.com', date: 'Kemarin, 17:30', route: 'Jababeka 1 → Stasiun Cikarang', distance: '9.2 km', evVehicle: 'BYD Atto 3', brcDiscount: '5 BRC (Rp 25.000)', co2Avoided: '1.26 kg CO₂' },
                  { employee: 'ratna.dewi@cikarang-mobility.com', date: 'Kemarin, 08:00', route: 'Kemang Pratama → Cikarang Dry Port', distance: '24.1 km', evVehicle: 'Hyundai Ioniq 5', brcDiscount: '10 BRC (Rp 50.000)', co2Avoided: '3.30 kg CO₂' },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>{item.employee}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                          {item.evVehicle}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-1">
                        <span>{item.route}</span>
                        <span>•</span>
                        <span>{item.distance}</span>
                        <span>•</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                      <span className="text-emerald-400 font-mono font-medium">{item.co2Avoided}</span>
                      <span className="text-[11px] text-zinc-400 font-mono">Diskon: {item.brcDiscount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
