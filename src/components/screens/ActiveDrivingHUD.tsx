'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Zap,
  Flame,
  ShieldAlert,
  Sparkles,
  StopCircle,
  Eye,
  EyeOff,
  Clock,
  MapPin,
  Database,
  Radio,
  WifiOff,
  Moon,
  Sun,
  UserRound,
  Navigation,
} from 'lucide-react';
import { useTelematics, TelematicsState } from '@/hooks/useTelematics';
import { useSilentWatchdog } from '@/hooks/useSilentWatchdog';
import { LiveProofCapture } from '@/components/LiveProofCapture';
import { cleanupTelemetry } from '@/lib/telemetry-cleanup';
import { EcoProfile, type TripPhase, type PhotoEvidence, type TripSecurityContext } from '@/types/telematics';
import { formatTime } from '@/lib/utils';

interface ActiveDrivingHUDProps {
  onEndTrip: (telemetry: TelematicsState, security: TripSecurityContext) => void;
  tripId?: string;
  useLiveSensors?: boolean;
  /** Fase awal dari state machine (default DISPATCHED — langsung OTW jemput) */
  initialPhase?: TripPhase;
  /** Notifikasi perubahan fase ke state machine di parent */
  onPhaseChange?: (phase: TripPhase) => void;
  /** Mode simulasi desktop/e2e: watchdog tidak menandai anomali */
  simulateMode?: boolean;
}

export function ActiveDrivingHUD({
  onEndTrip,
  tripId = `trk_${Date.now()}`,
  useLiveSensors = true,
  initialPhase = 'DISPATCHED',
  onPhaseChange,
  simulateMode = false,
}: ActiveDrivingHUDProps) {
  const telemetry = useTelematics({
    tripId,
    enabled: useLiveSensors,
    useMockFallback: true,
  });

  const [phase, setPhase] = useState<TripPhase>(initialPhase);
  const [proofEvidence, setProofEvidence] = useState<PhotoEvidence | null>(null);
  // Snapshot jarak saat penumpang naik = deadhead miles (Scope 3 absolut)
  const deadheadDistanceRef = useRef<number | null>(null);
  const [ultraMinimalOled, setUltraMinimalOled] = useState(false);
  const [showSensorPanel, setShowSensorPanel] = useState(true);
  const [activeProfile, setActiveProfile] = useState<EcoProfile>('HIGHWAY_NORMAL');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // ══ Invisible Security: watchdog diam-diam (2 menit pertama) ══
  // Modal LiveProofCapture HANYA dirender saat ANOMALY_DETECTED.
  const handleAnomaly = useCallback(() => {
    // Tidak perlu setState tambahan — status watchdog sudah memicu render modal
  }, []);

  const watchdog = useSilentWatchdog({
    enabled: useLiveSensors && (phase === 'DISPATCHED' || phase === 'PASSENGER_PICKED_UP'),
    gpsSpeedKmh: telemetry.speedKmh > 0 ? telemetry.speedKmh : null,
    simulateMode,
    onAnomaly: handleAnomaly,
  });

  const isProofLocked = watchdog.status === 'ANOMALY_DETECTED' && !proofEvidence;

  /** Freezer penuh: trip hanya bisa dilanjutkan setelah proof tervalidasi */
  const handleProofValidated = useCallback((evidence: PhotoEvidence) => {
    setProofEvidence(evidence);
  }, []);

  /** Kumpulkan konteks keamanan untuk payload verifikasi */
  const buildSecurityContext = useCallback((): TripSecurityContext => ({
    watchdogFlagged: watchdog.status === 'ANOMALY_DETECTED',
    watchdogReason: watchdog.reason,
    deadheadDistanceKm: deadheadDistanceRef.current ?? 0,
    proofEvidence,
  }), [watchdog.status, watchdog.reason, proofEvidence]);

  const toggleProfile = () => {
    setActiveProfile((p) =>
      p === 'HIGHWAY_NORMAL' ? 'URBAN_RUSH_HOUR' : 'HIGHWAY_NORMAL',
    );
  };

  const speedDisplay = Math.round(telemetry.speedKmh);
  const speedLimitKmh = activeProfile === 'HIGHWAY_NORMAL' ? 80 : 50;

  const liveEcoScore = useMemo(() => {
    const base = 100;
    const harshPenalty = telemetry.harshAccelCount * 3;
    const brakePenalty = telemetry.harshBrakeCount * 4;
    const idlePenaltyMins = Math.floor(telemetry.idleDurationSec / 300);
    return Math.max(50, base - harshPenalty - brakePenalty - idlePenaltyMins);
  }, [telemetry.harshAccelCount, telemetry.harshBrakeCount, telemetry.idleDurationSec]);

  const pollingLabel = telemetry.pollingTier === 'FAST'
    ? '1.0 Hz'
    : telemetry.pollingTier === 'MEDIUM'
    ? '5s'
    : '15s';

  const phaseLabel: Record<TripPhase, string> = {
    IDLE: 'Idle',
    DISPATCHED: 'OTW Jemput (Deadhead)',
    PASSENGER_PICKED_UP: 'Penumpang di',
    COMPLETED: 'Selesai',
  };

  const watchdogLabel: Record<string, string> = {
    IDLE: 'OFF',
    RUNNING: `AKTIF ${Math.ceil((watchdog.remainingMs ?? 0) / 1000)}s`,
    CLEAN: 'BERSIH',
    ANOMALY_DETECTED: 'ANOMALI',
  };

  // ══ FREEZE: modal membekukan seluruh aplikasi ══
  if (isProofLocked) {
    return (
      <LiveProofCapture
        onValidated={handleProofValidated}
        reason={watchdog.reason}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full bg-black text-white select-none overflow-hidden relative">
      {/* TOP BAR */}
      <div className="relative z-10 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={toggleProfile}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeProfile === 'HIGHWAY_NORMAL' ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
            />
            <span className="text-zinc-300 font-medium">
              {activeProfile === 'HIGHWAY_NORMAL' ? 'Highway' : 'Urban'}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <div
              className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-[10px] font-mono ${
                telemetry.wakeLockActive
                  ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500'
              }`}
            >
              {telemetry.wakeLockActive ? (
                <Sun className="w-3 h-3" />
              ) : (
                <Moon className="w-3 h-3" />
              )}
              <span>{telemetry.wakeLockActive ? 'WAKE' : 'SLEEP'}</span>
            </div>

            {!isOnline && (
              <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-amber-950/50 border border-amber-800/50 text-[10px] font-mono text-amber-400">
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE</span>
              </div>
            )}

            <button
              onClick={() => setUltraMinimalOled(!ultraMinimalOled)}
              className="flex items-center space-x-1 px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 font-mono"
            >
              {ultraMinimalOled ? (
                <>
                  <EyeOff className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Dim</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>OLED</span>
                </>
              )}
            </button>
          </div>
        </div>

        {!ultraMinimalOled && (
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-zinc-900 pb-2">
            <div className="flex items-center space-x-1.5">
              {telemetry.isGpsLocked ? (
                <MapPin className="w-3 h-3 text-emerald-400" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-400" />
              )}
              <span className={telemetry.isGpsLocked ? 'text-zinc-300' : 'text-red-400'}>
                {telemetry.isGpsLocked
                  ? `GPS (±${telemetry.accuracy.toFixed(1)}m)`
                  : 'Mencari GPS...'}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`flex items-center gap-1 ${telemetry.isAccelActive ? 'text-emerald-400' : 'text-zinc-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${telemetry.isAccelActive ? 'bg-emerald-400' : 'bg-zinc-700'}`}></span>
                {telemetry.isAccelActive ? 'ACCEL' : 'PAUSE'}
              </span>
              <span className="text-zinc-500 font-medium">{pollingLabel}</span>
            </div>
          </div>
        )}

        {!ultraMinimalOled && (
          <div className="flex items-center justify-between text-[11px] font-mono border-b border-zinc-900 pb-2">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Navigation className="w-3 h-3" />
              {phaseLabel[phase]}
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] ${
                watchdog.status === 'ANOMALY_DETECTED'
                  ? 'text-red-400'
                  : watchdog.status === 'CLEAN'
                  ? 'text-emerald-400'
                  : 'text-zinc-400'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              WATCHDOG {watchdogLabel[watchdog.status]}
            </span>
          </div>
        )}
      </div>

      {/* CENTER: SPEEDOMETER */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2">
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute w-56 h-56 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-500 ${
              telemetry.drivingStatus === 'harsh_accel'
                ? 'bg-amber-500'
                : telemetry.drivingStatus === 'sudden_brake'
                ? 'bg-red-500'
                : 'bg-emerald-500'
            }`}
          />

          <div className="flex flex-col items-center z-10 text-center">
            <div className="flex items-baseline justify-center">
              <span
                className={`text-8xl sm:text-9xl font-bold font-mono tracking-tight transition-colors duration-300 ${
                  ultraMinimalOled ? 'text-zinc-300' : 'text-white'
                }`}
              >
                {speedDisplay}
              </span>
            </div>
            <span className="text-xs uppercase font-mono font-medium tracking-widest text-zinc-400 -mt-2">
              km/jam
            </span>

            <div className="mt-3 flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full border-2 bg-zinc-950 flex items-center justify-center text-xs font-mono font-medium text-white ${
                  speedDisplay > speedLimitKmh ? 'border-red-500' : 'border-zinc-700'
                }`}
              >
                {speedLimitKmh}
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {speedDisplay > speedLimitKmh ? 'Batas terlampaui' : 'Batas'}
              </span>
            </div>
          </div>
        </div>

        {/* Driving Status */}
        <div className="mt-6 w-full max-w-xs">
          <div
            className={`py-2 px-4 rounded-xl border flex items-center justify-between text-xs font-medium transition-colors ${
              telemetry.drivingStatus === 'smooth'
                ? 'bg-zinc-950 border-emerald-500/50 text-emerald-300'
                : telemetry.drivingStatus === 'harsh_accel'
                ? 'bg-zinc-950 border-amber-500 text-amber-300'
                : telemetry.drivingStatus === 'sudden_brake'
                ? 'bg-zinc-950 border-red-500 text-red-300'
                : 'bg-zinc-950 border-zinc-700 text-zinc-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              {telemetry.drivingStatus === 'smooth' && <Sparkles className="w-4 h-4 text-emerald-400" />}
              {telemetry.drivingStatus === 'harsh_accel' && <Flame className="w-4 h-4 text-amber-400" />}
              {telemetry.drivingStatus === 'sudden_brake' && <ShieldAlert className="w-4 h-4 text-red-400" />}
              {telemetry.drivingStatus === 'idle' && <Clock className="w-4 h-4 text-zinc-400" />}
              <span>{telemetry.statusMessage}</span>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              {telemetry.accelMagnitude > 0 ? telemetry.accelMagnitude.toFixed(1) : '0.0'} m/s²
            </span>
          </div>
        </div>
      </div>

      {/* LOWER: METRICS */}
      <div className="relative z-10 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>ECO</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold font-mono text-white">{liveEcoScore}</span>
              <span className="text-[10px] text-zinc-400 font-mono ml-1">/100</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>TRIP</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1">
              <span className="text-base font-bold font-mono text-white">
                {formatTime(telemetry.tripDurationSec)}
              </span>
              <p className="text-[10px] text-zinc-400 font-mono">{telemetry.tripDistanceKm} km</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono">
              <span>BUF</span>
              <Database className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1">
              <span className="text-base font-bold font-mono text-amber-400">
                {telemetry.pointsBuffered}
              </span>
              <p className="text-[10px] text-zinc-400 font-mono">{telemetry.pointsFlushed} flushed</p>
            </div>
          </div>
        </div>

        {showSensorPanel && !ultraMinimalOled && (
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-1.5">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400" />
                SENSOR
              </span>
              <button onClick={() => setShowSensorPanel(false)} className="text-zinc-500 hover:text-zinc-300">
                Tutup
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
                <span className="text-zinc-500">GPS</span>
                <div className="text-zinc-200">{telemetry.lat.toFixed(5)}, {telemetry.lng.toFixed(5)}</div>
                <div className="text-zinc-400">±{telemetry.accuracy.toFixed(1)}m</div>
              </div>
              <div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
                <span className="text-zinc-500">ACCEL</span>
                <div className="text-zinc-200">x:{telemetry.accelX.toFixed(1)} y:{telemetry.accelY.toFixed(1)}</div>
                <div className="text-zinc-400">z:{telemetry.accelZ.toFixed(1)}</div>
              </div>
              <div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
                <span className="text-zinc-500">POLL</span>
                <div className="text-zinc-200">{telemetry.pollingTier} ({telemetry.currentPollingMs}ms)</div>
              </div>
              <div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
                <span className="text-zinc-500">EVENTS</span>
                <div className="text-zinc-200">
                  <span className="text-amber-400">+{telemetry.harshAccelCount}</span> acc{' '}
                  <span className="text-red-400">+{telemetry.harshBrakeCount}</span> brk
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-1">
          {phase === 'DISPATCHED' && (
            <button
              onClick={() => {
                // Deadhead berakhir di sini — catat jarak kosong terkumpul
                deadheadDistanceRef.current = telemetry.tripDistanceKm;
                setPhase('PASSENGER_PICKED_UP');
                onPhaseChange?.('PASSENGER_PICKED_UP');
              }}
              className="w-full py-3 px-4 mb-2 bg-cyan-600/90 hover:bg-cyan-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
            >
              <UserRound className="w-5 h-5" />
              <span>Penumpang Sudah Naik</span>
            </button>
          )}
          <button
            onClick={() => {
              // COMPLETED: hentikan SEMUA resource telematik (anti memory leak)
              cleanupTelemetry();
              onEndTrip(telemetry, buildSecurityContext());
            }}
            className="w-full py-3.5 px-4 bg-red-600/90 hover:bg-red-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
          >
            <StopCircle className="w-5 h-5" />
            <span>Selesai Trip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
