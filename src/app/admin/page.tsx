'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  TreeDeciduous,
  Coins,
  Gauge,
  Clock,
  Users,
  Zap,
  BarChart3,
  Route,
  AlertTriangle,
} from 'lucide-react';

// Dynamic import for Leaflet (SSR-incompatible)
const TripMap = dynamic(
  () => import('@/components/admin/TripMap').then((m) => m.TripMap),
  { ssr: false, loading: () => <div className="h-[400px] bg-zinc-900 rounded-xl animate-pulse flex items-center justify-center text-zinc-500 text-sm">Loading Map...</div> },
);

// ── Mock data for admin dashboard demo ──────────────────────
const MOCK_VERIFIED_TRIPS = [
  {
    trip_id: 'trk_jabo_98231',
    driver_name: 'Budi Santoso',
    vehicle: 'Ioniq 5 (B 1024 BRG)',
    profile: 'HIGHWAY_NORMAL',
    distance_km: 61.8,
    eco_score: 94,
    eco_grade: 'A+' as const,
    tokens: 70,
    co2_avoided_kg: 7.42,
    duration_min: 75,
    status: 'VERIFIED' as const,
    start_time: '2026-09-28T06:00:00Z',
    verification: {
      hash_match: true,
      physics_check: true,
      osrm_processed: true,
      gaps_detected: 0,
      confidence: 0.98,
      matched_distance_km: 62.1,
    },
  },
  {
    trip_id: 'trk_jabo_98232',
    driver_name: 'Siti Aminah',
    vehicle: 'BYD Atto 3 (B 1892 BRG)',
    profile: 'URBAN_RUSH_HOUR',
    distance_km: 34.2,
    eco_score: 87,
    eco_grade: 'A' as const,
    tokens: 35,
    co2_avoided_kg: 4.10,
    duration_min: 92,
    status: 'VERIFIED' as const,
    start_time: '2026-09-28T07:30:00Z',
    verification: {
      hash_match: true,
      physics_check: true,
      osrm_processed: true,
      gaps_detected: 2,
      confidence: 0.94,
      matched_distance_km: 34.8,
    },
  },
  {
    trip_id: 'trk_jabo_98233',
    driver_name: 'Andi Wijaya',
    vehicle: 'Wuling BinguoEV (B 2341 BRG)',
    profile: 'URBAN_RUSH_HOUR',
    distance_km: 18.5,
    eco_score: 65,
    eco_grade: 'C' as const,
    tokens: 10,
    co2_avoided_kg: 2.22,
    duration_min: 58,
    status: 'REJECTED' as const,
    start_time: '2026-09-28T16:45:00Z',
    verification: {
      hash_match: true,
      physics_check: false,
      osrm_processed: true,
      gaps_detected: 5,
      confidence: 0.62,
      matched_distance_km: 15.2,
    },
  },
];

// Mock OSRM matched route — Cikarang to Soekarno-Hatta approximate
const MOCK_MATCHED_ROUTE: [number, number][] = [
  [-6.3171, 107.1737], // Cikarang Dry Port
  [-6.3105, 107.1545],
  [-6.2983, 107.1289],
  [-6.2844, 107.0976],
  [-6.2701, 107.0632],
  [-6.2599, 107.0321],
  [-6.2510, 106.9987],
  [-6.2455, 106.9712],
  [-6.2410, 106.9465],
  [-6.2321, 106.9198],
  [-6.2245, 106.8932],
  [-6.2188, 106.8698],
  [-6.2112, 106.8432],
  [-6.2045, 106.8198],
  [-6.1989, 106.7932],
  [-6.1901, 106.7665],
  [-6.1821, 106.7398],
  [-6.1745, 106.7132],
  [-6.1672, 106.6865],
  [-6.1259, 106.6556], // Bandara Soekarno-Hatta
];

const MOCK_RAW_GPS: [number, number][] = [
  [-6.3175, 107.1742],
  [-6.3108, 107.1540],
  [-6.2990, 107.1295],
  [-6.2838, 107.0982],
  [-6.2695, 107.0628],
  [-6.2605, 107.0315],
  [-6.2515, 106.9992],
  [-6.2460, 106.9708],
  [-6.2405, 106.9472],
  [-6.2328, 106.9193],
  [-6.2242, 106.8940],
  [-6.2195, 106.8692],
  [-6.2108, 106.8440],
  [-6.2048, 106.8203],
  [-6.1985, 106.7928],
  [-6.1908, 106.7670],
  [-6.1826, 106.7402],
  [-6.1738, 106.7128],
  [-6.1678, 106.6870],
  [-6.1255, 106.6550],
];

export default function AdminDashboard() {
  const [selectedTrip, setSelectedTrip] = useState(MOCK_VERIFIED_TRIPS[0]);

  // Fleet aggregates
  const totalTrips = MOCK_VERIFIED_TRIPS.length;
  const totalVerified = MOCK_VERIFIED_TRIPS.filter((t) => t.status === 'VERIFIED').length;
  const totalDistanceKm = MOCK_VERIFIED_TRIPS.reduce((s, t) => s + t.distance_km, 0);
  const totalCO2 = MOCK_VERIFIED_TRIPS.reduce((s, t) => s + t.co2_avoided_kg, 0);
  const avgEcoScore = Math.round(
    MOCK_VERIFIED_TRIPS.reduce((s, t) => s + t.eco_score, 0) / totalTrips,
  );
  const totalTokens = MOCK_VERIFIED_TRIPS.reduce((s, t) => s + t.tokens, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-6 h-6 fill-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                briga<span className="text-emerald-400">.id</span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  ADMIN FLEET
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Fleet Management & ESG Dashboard — Jabodetabek Corridor
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
          </span>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total Trips', value: totalTrips, icon: Route, color: 'text-cyan-400' },
            { label: 'Verified', value: `${totalVerified}/${totalTrips}`, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Total Jarak', value: `${totalDistanceKm.toFixed(1)} km`, icon: Gauge, color: 'text-white' },
            { label: 'Avg Eco Score', value: avgEcoScore, icon: BarChart3, color: 'text-emerald-400' },
            { label: 'CO₂ Dihindari', value: `${totalCO2.toFixed(1)} kg`, icon: TreeDeciduous, color: 'text-emerald-400' },
            { label: 'Tokens Distributed', value: totalTokens, icon: Coins, color: 'text-amber-400' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mb-1">
                <span className="uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className={`text-lg font-bold font-mono ${kpi.color}`}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>

        {/* Main Content: Map + Trip Table */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Trip Table (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Trip Log Hari Ini
            </h2>

            <div className="space-y-2">
              {MOCK_VERIFIED_TRIPS.map((trip) => (
                <button
                  key={trip.trip_id}
                  onClick={() => setSelectedTrip(trip)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedTrip.trip_id === trip.trip_id
                      ? 'bg-zinc-900 border-emerald-500/50 ring-1 ring-emerald-500/30'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">
                      {trip.driver_name}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      trip.status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : 'bg-red-950 text-red-400 border border-red-800/40'
                    }`}>
                      {trip.status === 'VERIFIED'
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <XCircle className="w-3 h-3" />}
                      {trip.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 font-mono">
                    {trip.vehicle}
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300">{trip.distance_km} km</span>
                      <span className="text-zinc-400">{trip.duration_min} min</span>
                      <span className={`font-bold ${
                        trip.eco_score >= 85 ? 'text-emerald-400'
                          : trip.eco_score >= 70 ? 'text-amber-400'
                          : 'text-red-400'
                      }`}>
                        {trip.eco_grade} ({trip.eco_score})
                      </span>
                    </div>
                    <span className="text-amber-400">+{trip.tokens} 🪙</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Map + Trip Details (Right 3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Rute OSRM Map-Matched — {selectedTrip.trip_id}
            </h2>

            {/* Leaflet Map */}
            <TripMap
              matchedRoute={MOCK_MATCHED_ROUTE}
              rawPoints={MOCK_RAW_GPS}
              height="400px"
            />

            {/* Map Legend */}
            <div className="flex items-center gap-4 text-[11px] text-zinc-400 font-mono px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-emerald-500 rounded"></span>
                OSRM Matched (Snapped)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-red-500 rounded border-dashed"></span>
                Raw GPS Trace
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Start
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> End
              </span>
            </div>

            {/* Verification Details Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Detail Verifikasi Server
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">Hash Match</span>
                  <div className={selectedTrip.verification.hash_match ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedTrip.verification.hash_match ? '✓ PASS' : '✗ FAIL'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">Physics Check</span>
                  <div className={selectedTrip.verification.physics_check ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedTrip.verification.physics_check ? '✓ REALISTIC' : '✗ SUSPICIOUS'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">OSRM Match</span>
                  <div className={selectedTrip.verification.osrm_processed ? 'text-emerald-400 font-bold' : 'text-zinc-400 font-bold'}>
                    {selectedTrip.verification.osrm_processed ? '✓ SNAPPED' : 'PENDING'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">GPS Gaps</span>
                  <div className={selectedTrip.verification.gaps_detected === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {selectedTrip.verification.gaps_detected} gap(s)
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">OSRM Distance</span>
                  <div className="text-cyan-400 font-bold">
                    {selectedTrip.verification.matched_distance_km} km
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">Confidence</span>
                  <div className={selectedTrip.verification.confidence >= 0.9 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {(selectedTrip.verification.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Warning for rejected trips */}
              {selectedTrip.status === 'REJECTED' && (
                <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-red-300">
                    <strong>Trip ditolak oleh sistem.</strong> Physics sanity check gagal — kemungkinan GPS mock / spoof terdeteksi.
                    Tokens tidak diberikan. Driver perlu konfirmasi manual ke Fleet Manager.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
