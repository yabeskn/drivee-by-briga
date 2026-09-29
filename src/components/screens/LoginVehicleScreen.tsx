'use client';

import React, { useState } from 'react';
import {
  Car,
  BatteryCharging,
  Gauge,
  Phone,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  Sparkles,
  MapPin,
  Compass,
  Camera,
  Check,
} from 'lucide-react';
import { MOCK_DRIVER, MOCK_VEHICLES } from '@/lib/mock-data';
import { EVVehicle, PhotoEvidence } from '@/types/telematics';
import { CameraCapture } from '@/components/CameraCapture';

interface LoginVehicleScreenProps {
  onStartTrip: (config: {
    vehicle: EVVehicle;
    startSoc: number;
    startOdo: number;
    corridor: string;
    photoEvidence: PhotoEvidence;
  }) => void;
}

export function LoginVehicleScreen({ onStartTrip }: LoginVehicleScreenProps) {
  const [step, setStep] = useState<'auth' | 'vehicle' | 'ready' | 'photo'>('auth');
  const [phone, setPhone] = useState('081298765432');
  const [pin, setPin] = useState('889900');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<EVVehicle>(MOCK_VEHICLES[0]);

  const [initialSoc, setInitialSoc] = useState<number>(MOCK_VEHICLES[0].currentSoC);
  const [initialOdo, setInitialOdo] = useState<number>(14250.0);
  const [corridor, setCorridor] = useState('Cikarang Dry Port ➔ Bandara Soetta T3');

  const [photoEvidence, setPhotoEvidence] = useState<PhotoEvidence>({
    odometerPhoto: null,
    batteryPhoto: null,
    capturedAt: 0,
    gpsLocation: null,
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('drivee_logged_in', 'true');
    setIsLoggedIn(true);
    setStep('vehicle');
  };

  const handleSelectVehicle = (vehicle: EVVehicle) => {
    setSelectedVehicle(vehicle);
    setInitialSoc(vehicle.currentSoC);
    setStep('ready');
  };

  const handleConfirmStart = () => {
    setStep('photo');
  };

  const handlePhotoCapture = (evidence: {
    odometerPhoto: string | null;
    batteryPhoto: string | null;
    capturedAt: number;
    gpsLocation: { lat: number; lng: number } | null;
  }) => {
    setPhotoEvidence(evidence);
    onStartTrip({
      vehicle: selectedVehicle,
      startSoc: initialSoc,
      startOdo: initialOdo,
      corridor,
      photoEvidence: evidence,
    });
  };

  const handlePhotoCancel = () => {
    setStep('ready');
  };

  if (step === 'photo') {
    return (
      <CameraCapture
        onCapture={handlePhotoCapture}
        onCancel={handlePhotoCancel}
        title="Bukti Fisik Awal Trip"
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 pb-20 max-w-md mx-auto w-full">
      {/* Brand Header */}
      <div className="flex items-center justify-between py-3 mb-3 border-b border-zinc-900">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <svg viewBox="0 0 512 512" className="w-5 h-5">
              <rect width="512" height="512" rx="128" fill="#000000"/>
              <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" stroke-width="12"/>
              <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#34d399"/>
              <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round"/>
              <path d="M380 380 Q400 360 380 340 Q360 360 380 380" fill="#10b981"/>
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">
              Drifee
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono font-normal ml-1.5">
                by Briga
              </span>
            </h1>
            <p className="text-[11px] text-zinc-500">Drive, Earn, and Track safely</p>
          </div>
        </div>

        {isLoggedIn && (
          <div className="flex items-center space-x-2 bg-zinc-900/80 px-2.5 py-1 rounded-full border border-zinc-800">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[90px]">
              {MOCK_DRIVER.name.split(' ')[0]}
            </span>
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-4 gap-1.5 mb-5 select-none">
        <div className={`h-1.5 rounded-full ${step === 'auth' ? 'bg-emerald-400' : 'bg-emerald-800'}`} />
        <div className={`h-1.5 rounded-full ${step === 'vehicle' ? 'bg-emerald-400' : step === 'ready' ? 'bg-emerald-800' : 'bg-zinc-800'}`} />
        <div className={`h-1.5 rounded-full ${step === 'ready' ? 'bg-emerald-400' : 'bg-zinc-800'}`} />
        <div className="h-1.5 rounded-full bg-zinc-800" />
      </div>

      {/* STEP 1: AUTH */}
      {step === 'auth' && (
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
                Langkah 1 dari 4
              </span>
              <h2 className="text-xl font-semibold text-white mt-1">Login Driver</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Masuk untuk memulai shift mengemudi EV.
              </p>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 mb-5">
              <div className="flex items-center justify-between text-xs text-emerald-300 font-medium mb-1.5">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Akun Demo
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-300">
                <span>Driver: <strong className="text-white">{MOCK_DRIVER.name}</strong></span>
                <span className="text-emerald-400 font-mono">{MOCK_DRIVER.totalBrigaCoins} Coins</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Nomor Handphone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="0812xxxxxxx"
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  PIN / Kode OTP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required
                    placeholder="••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-widest font-mono transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors"
                >
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          <div className="pt-6 border-t border-zinc-900 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verifikasi Kriptografis SHA-256</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: VEHICLE SELECTION */}
      {step === 'vehicle' && (
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
                Langkah 2 dari 4
              </span>
              <h2 className="text-xl font-semibold text-white mt-1">Pilih Kendaraan</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Pilih unit EV untuk shift Anda.
              </p>
            </div>

            <div className="space-y-3">
              {MOCK_VEHICLES.map((vehicle) => {
                const isSelected = selectedVehicle.id === vehicle.id;
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => handleSelectVehicle(vehicle)}
                    className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 border-emerald-500'
                        : 'bg-zinc-900/60 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                            {vehicle.code}
                          </span>
                          <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                            {vehicle.licensePlate}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-white mt-1.5">{vehicle.name}</h3>
                        <p className="text-[11px] text-zinc-500">{vehicle.model}</p>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-1 text-emerald-400 font-mono text-sm font-medium">
                          <BatteryCharging className="w-4 h-4" />
                          <span>{vehicle.currentSoC}%</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">~{vehicle.estimatedRangeKm} km</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[160px]">{vehicle.hubLocation}</span>
                      </div>
                      <div className="font-mono text-zinc-400">
                        {vehicle.batteryCapacityKwh} kWh
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-6">
            <button
              onClick={() => setStep('ready')}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PRE-DRIVE CHECK */}
      {step === 'ready' && (
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
                Langkah 3 dari 4
              </span>
              <h2 className="text-xl font-semibold text-white mt-1">Status Awal</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Catat kondisi kendaraan sebelum perjalanan.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Kendaraan</span>
                <h4 className="text-sm font-medium text-white">{selectedVehicle.name}</h4>
                <p className="text-xs font-mono text-emerald-400">{selectedVehicle.licensePlate} • {selectedVehicle.batteryCapacityKwh} kWh</p>
              </div>
              <button
                onClick={() => setStep('vehicle')}
                className="text-xs text-zinc-400 hover:text-emerald-400 underline underline-offset-2"
              >
                Ganti
              </button>
            </div>

            <div className="space-y-3.5 mb-5">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
                <label className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    Baterai (SoC %)
                  </span>
                  <span className="font-mono text-emerald-400 font-medium">{initialSoc}%</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={initialSoc}
                  onChange={(e) => setInitialSoc(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>20%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
                <label className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    Odometer (km)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={initialOdo}
                    onChange={(e) => setInitialOdo(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">KM</span>
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 mb-1.5">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  Koridor Rute
                </label>
                <select
                  value={corridor}
                  onChange={(e) => setCorridor(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Cikarang Dry Port ➔ Bandara Soetta T3">
                    Cikarang ➔ Bandara Soetta (62 km)
                  </option>
                  <option value="Halim Perdanakusuma ➔ Kawasan Industri MM2100">
                    Halim PK ➔ Cikarang MM2100 (45 km)
                  </option>
                  <option value="Jabodetabek Urban Shuttle Hub">
                    Jabodetabek Urban Transit
                  </option>
                </select>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <Camera className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-300">Verifikasi Anti-Spoofing</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">
                    Foto Odometer & Baterai wajib diambil sebelum perjalanan dimulai.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 space-y-2 mb-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> GPS
                </span>
                <span className="text-emerald-400 font-mono font-medium">READY</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Motion Sensor
                </span>
                <span className="text-emerald-400 font-mono font-medium">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> WakeLock
                </span>
                <span className="text-emerald-400 font-mono font-medium">ENABLED</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleConfirmStart}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <Camera className="w-5 h-5" />
              <span>Mulai Perjalanan</span>
            </button>
            <p className="text-[10px] text-center text-zinc-500 mt-2 font-mono">
              Foto bukti fisik diwajibkan
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
