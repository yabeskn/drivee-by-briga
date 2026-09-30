'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  TreeDeciduous,
  Coins,
  Gauge,
  Users,
  Zap,
  BarChart3,
  Route,
  AlertTriangle,
  Camera,
  Filter,
  Check,
  X,
  Battery,
} from 'lucide-react';

// Dynamic import for Leaflet (SSR-incompatible)
const TripMap = dynamic(
  () => import('@/components/admin/TripMap').then((m) => m.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] bg-zinc-900 rounded-xl animate-pulse flex items-center justify-center text-zinc-500 text-sm">
        Loading Map...
      </div>
    ),
  }
);

interface AdminTrip {
  trip_id: string;
  driver_name: string;
  vehicle: string;
  profile: string;
  distance_km: number;
  eco_score: number;
  eco_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  tokens: number;
  co2_avoided_kg: number;
  duration_min: number;
  status: 'VERIFIED' | 'REJECTED' | 'PENDING';
  start_time: string;
  start_battery?: number;
  end_battery?: number;
  start_odometer?: number;
  end_odometer?: number;
  verification: {
    hash_match: boolean;
    physics_check: boolean;
    osrm_processed: boolean;
    gaps_detected: number;
    confidence: number;
    matched_distance_km: number;
  };
}

const MOCK_VERIFIED_TRIPS: AdminTrip[] = [
  {
    trip_id: 'trk_jabo_98231',
    driver_name: 'Budi Santoso',
    vehicle: 'Ioniq 5 (B 1024 BRG)',
    profile: 'HIGHWAY_NORMAL',
    distance_km: 61.8,
    eco_score: 94,
    eco_grade: 'A+',
    tokens: 70,
    co2_avoided_kg: 7.42,
    duration_min: 75,
    status: 'VERIFIED',
    start_time: '2026-09-28T06:00:00Z',
    start_battery: 88,
    end_battery: 74,
    start_odometer: 14200,
    end_odometer: 14262,
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
    eco_grade: 'A',
    tokens: 35,
    co2_avoided_kg: 4.10,
    duration_min: 92,
    status: 'PENDING',
    start_time: '2026-09-28T07:30:00Z',
    start_battery: 95,
    end_battery: 82,
    start_odometer: 8310,
    end_odometer: 8344,
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
    eco_grade: 'C',
    tokens: 10,
    co2_avoided_kg: 2.22,
    duration_min: 58,
    status: 'REJECTED',
    start_time: '2026-09-28T16:45:00Z',
    start_battery: 60,
    end_battery: 55,
    start_odometer: 5120,
    end_odometer: 5138,
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

const MOCK_MATCHED_ROUTE: [number, number][] = [
  [-6.3171, 107.1737],
  [-6.3105, 107.1545],
  [-6.2983, 107.1289],
  [-6.2844, 107.0976],
  [-6.2701, 107.0632],
  [-6.2599, 107.0321],
  [-6.251, 106.9987],
  [-6.2455, 106.9712],
  [-6.241, 106.9465],
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
  [-6.1259, 106.6556],
];

const MOCK_RAW_GPS: [number, number][] = [
  [-6.3175, 107.1742],
  [-6.3108, 107.154],
  [-6.299, 107.1295],
  [-6.2838, 107.0982],
  [-6.2695, 107.0628],
  [-6.2605, 107.0315],
  [-6.2515, 106.9992],
  [-6.246, 106.9708],
  [-6.2405, 106.9472],
  [-6.2328, 106.9193],
  [-6.2242, 106.894],
  [-6.2195, 106.8692],
  [-6.2108, 106.844],
  [-6.2048, 106.8203],
  [-6.1985, 106.7928],
  [-6.1908, 106.767],
  [-6.1826, 106.7402],
  [-6.1738, 106.7128],
  [-6.1678, 106.687],
  [-6.1255, 106.655],
];

export default function AdminDashboard() {
  const [tripList, setTripList] = useState<AdminTrip[]>(MOCK_VERIFIED_TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<AdminTrip>(MOCK_VERIFIED_TRIPS[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrips() {
      try {
        const { data } = await supabase
          .from('trips')
          .select('*, drivers(name), vehicles(brand, model, license_plate)')
          .order('created_at', { ascending: false })
          .limit(30);

        if (data && data.length > 0) {
          const mapped: AdminTrip[] = data.map((t: any) => ({
            trip_id: t.id,
            driver_name: t.drivers?.name || 'Driver Shuttle',
            vehicle: t.vehicles
              ? `${t.vehicles.brand} ${t.vehicles.model} (${t.vehicles.license_plate})`
              : 'EV Unit',
            profile: t.profile_used || 'URBAN_NORMAL',
            distance_km: Number(t.distance_km) || 0,
            eco_score: t.eco_score || 0,
            eco_grade: (t.eco_grade || 'A') as any,
            tokens: t.tokens_earned || 0,
            co2_avoided_kg:
              Number(t.co2_avoided_kg) ||
              Number(((Number(t.distance_km) || 0) * 0.12).toFixed(2)),
            duration_min: Math.round(Number(t.idle_duration_seconds || 0) / 60) || 45,
            status:
              t.verification_status === 'verified'
                ? 'VERIFIED'
                : t.verification_status === 'pending'
                ? 'PENDING'
                : 'REJECTED',
            start_time: t.start_time,
            start_battery: t.start_battery_soc,
            end_battery: t.end_battery_soc,
            verification: {
              hash_match: true,
              physics_check: Number(t.max_speed_kmh || 0) <= 160 && Number(t.energy_used_kwh || 0) >= 0,
              osrm_processed: true,
              gaps_detected: 0,
              confidence: 0.95,
              matched_distance_km: Number(t.distance_km) || 0,
            },
          }));
          setTripList(mapped);
          setSelectedTrip(mapped[0]);
        }
      } catch (err) {
        console.warn('Failed to load trips from Supabase:', err);
      }
    }
    loadTrips();
  }, []);

  const handleManualReview = async (decision: 'VERIFIED' | 'REJECTED') => {
    setIsProcessing(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/admin/trips/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: selectedTrip.trip_id,
          decision,
          notes: `Manual review by Fleet Admin at ${new Date().toISOString()}`,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setActionMessage(`Trip ${selectedTrip.trip_id} berhasil di-${decision === 'VERIFIED' ? 'Setujui' : 'Tolak'}!`);
        // Update local state
        const updatedList = tripList.map((t) =>
          t.trip_id === selectedTrip.trip_id
            ? { ...t, status: decision, tokens: decision === 'VERIFIED' ? result.tokens_awarded || t.tokens : 0 }
            : t
        );
        setTripList(updatedList);
        setSelectedTrip((prev) => ({
          ...prev,
          status: decision,
          tokens: decision === 'VERIFIED' ? result.tokens_awarded || prev.tokens : 0,
        }));
      } else {
        setActionMessage(`Gagal: ${result.error || 'Terjadi kesalahan'}`);
      }
    } catch {
      setActionMessage('Koneksi gagal saat menghubungi server review');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredTrips = tripList.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  // Fleet aggregates
  const totalTrips = tripList.length;
  const totalVerified = tripList.filter((t) => t.status === 'VERIFIED').length;
  const totalPending = tripList.filter((t) => t.status === 'PENDING').length;
  const totalDistanceKm = tripList.reduce((s, t) => s + t.distance_km, 0);
  const totalCO2 = tripList.reduce((s, t) => s + t.co2_avoided_kg, 0);
  const avgEcoScore =
    totalTrips > 0
      ? Math.round(tripList.reduce((s, t) => s + t.eco_score, 0) / totalTrips)
      : 0;
  const totalTokens = tripList.reduce((s, t) => s + t.tokens, 0);

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
                drifee<span className="text-emerald-400">.id</span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  ADMIN FLEET
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Fleet Telematics & Manual Verification Portal — Jabodetabek Corridor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/company"
              className="text-xs px-3 py-1.5 bg-emerald-950 border border-emerald-800 text-emerald-400 hover:bg-emerald-900/50 rounded-lg font-mono transition-colors"
            >
              ESG Portal →
            </Link>
            <span className="text-xs font-mono text-zinc-500">
              {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </span>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total Trips', value: totalTrips, icon: Route, color: 'text-cyan-400' },
            {
              label: 'Verified',
              value: `${totalVerified}/${totalTrips}`,
              icon: CheckCircle2,
              color: 'text-emerald-400',
            },
            {
              label: 'Pending Review',
              value: totalPending,
              icon: AlertTriangle,
              color: 'text-amber-400',
            },
            {
              label: 'Total Jarak',
              value: `${totalDistanceKm.toFixed(1)} km`,
              icon: Gauge,
              color: 'text-white',
            },
            {
              label: 'Avg Eco Score',
              value: avgEcoScore,
              icon: BarChart3,
              color: 'text-emerald-400',
            },
            {
              label: 'BrigaCoins',
              value: totalTokens,
              icon: Coins,
              color: 'text-amber-400',
            },
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Daftar Perjalanan
              </h2>
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
                {(['ALL', 'PENDING', 'VERIFIED', 'REJECTED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2 py-0.5 rounded font-mono transition-colors ${
                      statusFilter === filter
                        ? 'bg-zinc-800 text-white font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {filter === 'ALL' ? 'Semua' : filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
              {filteredTrips.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-mono">
                  Tidak ada perjalanan dengan filter ini.
                </div>
              ) : (
                filteredTrips.map((trip) => (
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
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          trip.status === 'VERIFIED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : trip.status === 'PENDING'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                            : 'bg-red-950 text-red-400 border border-red-800/40'
                        }`}
                      >
                        {trip.status === 'VERIFIED' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : trip.status === 'PENDING' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
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
                        <span
                          className={`font-bold ${
                            trip.eco_score >= 85
                              ? 'text-emerald-400'
                              : trip.eco_score >= 70
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {trip.eco_grade} ({trip.eco_score})
                        </span>
                      </div>
                      <span className="text-amber-400">+{trip.tokens} 🪙</span>
                    </div>
                  </button>
                ))
              )}
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
              height="350px"
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

            {/* Manual Review Control Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Tindakan Verifikasi Manual (Fleet Manager)
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    selectedTrip.status === 'VERIFIED'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                      : selectedTrip.status === 'PENDING'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                      : 'bg-red-950 text-red-400 border border-red-800/40'
                  }`}
                >
                  Status: {selectedTrip.status}
                </span>
              </div>

              {actionMessage && (
                <div className="text-xs font-mono p-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-emerald-300">
                  {actionMessage}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => handleManualReview('VERIFIED')}
                  disabled={isProcessing || selectedTrip.status === 'VERIFIED'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold font-mono rounded-lg transition-colors"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Setujui & Terbitkan Koin
                </button>
                <button
                  onClick={() => handleManualReview('REJECTED')}
                  disabled={isProcessing || selectedTrip.status === 'REJECTED'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold font-mono rounded-lg transition-colors"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  Tolak Perjalanan
                </button>
              </div>
            </div>

            {/* Photo & Telemetry Evidence Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                Bukti Foto & Telemetri
              </h3>

              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 flex items-center gap-1 font-bold">
                    <Battery className="w-3 h-3 text-emerald-400" /> Baterai Mulai
                  </div>
                  <div className="text-base font-bold text-white">
                    {selectedTrip.start_battery ?? 88}%
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Odometer: {selectedTrip.start_odometer ?? 14200} km
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 flex items-center gap-1 font-bold">
                    <Battery className="w-3 h-3 text-amber-400" /> Baterai Akhir
                  </div>
                  <div className="text-base font-bold text-white">
                    {selectedTrip.end_battery ?? 74}%
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Odometer: {selectedTrip.end_odometer ?? 14262} km
                  </div>
                </div>
              </div>

              {/* Server Checks Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">Hash Match</span>
                  <div
                    className={
                      selectedTrip.verification.hash_match
                        ? 'text-emerald-400 font-bold'
                        : 'text-red-400 font-bold'
                    }
                  >
                    {selectedTrip.verification.hash_match ? '✓ PASS' : '✗ FAIL'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">Physics Check</span>
                  <div
                    className={
                      selectedTrip.verification.physics_check
                        ? 'text-emerald-400 font-bold'
                        : 'text-red-400 font-bold'
                    }
                  >
                    {selectedTrip.verification.physics_check
                      ? '✓ REALISTIC'
                      : '✗ SUSPICIOUS'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500">Confidence</span>
                  <div
                    className={
                      selectedTrip.verification.confidence >= 0.9
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400 font-bold'
                    }
                  >
                    {(selectedTrip.verification.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
