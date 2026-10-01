'use client';

import React, { useState } from 'react';
import {
  Trophy,
  Coins,
  BatteryCharging,
  Gauge,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Clock,
  TreeDeciduous,
  RotateCcw,
  TrendingUp,
  Loader2,
  Camera,
  Wallet,
  Building2,
  Sparkles,
} from 'lucide-react';

import { TripRecord, PhotoEvidence, TripSecurityContext, TripFinancialSplit } from '@/types/telematics';
import { TelematicsState } from '@/hooks/useTelematics';
import { submitAndVerifyTrip, type TripSubmissionResult } from '@/lib/trip-submitter';
import { EcoScoreBreakdown } from '@/lib/eco-score';
import { calculateTripFinancialSplit } from '@/lib/corporate/commute';
import { CameraCapture } from '@/components/CameraCapture';

interface EndTripDashboardProps {
  tripData?: TripRecord | null;
  finalTelemetry?: TelematicsState | null;
  onStartNewTrip: () => void;
  startPhotoEvidence?: PhotoEvidence;
  /** Konteks Invisible Security + Scope 3 dari HUD */
  securityContext?: TripSecurityContext | null;
}

export function EndTripDashboard({
  tripData,
  finalTelemetry,
  onStartNewTrip,
  startPhotoEvidence,
  securityContext,
}: EndTripDashboardProps) {
  // If no trip data, show empty state
  if (!tripData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8 text-zinc-600" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No Trip Data</h2>
        <p className="text-sm text-zinc-400 mb-6">Complete a trip to see your eco-driving summary.</p>
        <button
          onClick={onStartNewTrip}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
        >
          Start New Trip
        </button>
      </div>
    );
  }
  const [copiedHash, setCopiedHash] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<TripSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [endPhotoEvidence, setEndPhotoEvidence] = useState<PhotoEvidence | null>(null);

  const [finalSoc, setFinalSoc] = useState(tripData.end_battery_soc);
  const [finalOdo, setFinalOdo] = useState(tripData.end_odometer_km);

  const startSoc = tripData.start_battery_soc;
  const startOdo = tripData.start_odometer_km;
  const batteryCapKwh = 72.6;

  const calculatedDistance = Math.max(0, Number((finalOdo - startOdo).toFixed(1)));
  const calculatedSocUsed = Math.max(0, startSoc - finalSoc);
  const calculatedKwhUsed = Number(((calculatedSocUsed / 100) * batteryCapKwh).toFixed(2));

  // Hitung bagi hasil finansial pengemudi (Platform Fee Absorption)
  const financialSplit: TripFinancialSplit = tripData.financial_split ?? calculateTripFinancialSplit({
    grossFareIdr: Math.max(15000, Math.round((15000 + calculatedDistance * 4500) / 1000) * 1000),
    coinsToSpend: securityContext?.boardedPassenger?.discountBrc ?? 0,
    corporateName: securityContext?.boardedPassenger?.companyName,
  });

  /**
   * UX Anti-Friction: submit TIDAK menunggu foto. Foto bukti akhir
   * bersifat opsional — dikirim jika ada, null jika tidak. Server
   * memvalidasi foto hanya ketika tersedia.
   */
  const handleSubmit = async () => {
    if (!finalTelemetry) return;

    setIsSubmitting(true);

    try {
      const result = await submitAndVerifyTrip({
        tripId: tripData.trip_id,
        driverId: tripData.driver_id,
        vehicleId: tripData.vehicle_id,
        startTime: tripData.start_time,
        endTime: new Date().toISOString(),
        startBatterySoc: startSoc,
        endBatterySoc: finalSoc,
        startOdometerKm: startOdo,
        endOdometerKm: finalOdo,
        batteryCapacityKwh: batteryCapKwh,
        driverCurrentStreak: 0,
        telemetryState: finalTelemetry,
        startPhotoEvidence: startPhotoEvidence || null,
        endPhotoEvidence,
        deadheadDistanceKm: securityContext?.deadheadDistanceKm,
        tripPhaseTimeline: tripData.trip_phase_timeline ?? [],
        watchdogFlagged: securityContext?.watchdogFlagged,
        watchdogAnomalyReason: securityContext?.watchdogReason,
      });

      setSubmissionResult(result);
    } catch (error) {
      console.error('[EndTrip] Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoCapture = (evidence: {
    odometerPhoto: string | null;
    batteryPhoto: string | null;
    capturedAt: number;
    gpsLocation: { lat: number; lng: number } | null;
  }) => {
    setEndPhotoEvidence(evidence);
    setShowPhotoCapture(false);
  };

  const handlePhotoCancel = () => {
    setShowPhotoCapture(false);
  };

  const copyTripHash = () => {
    if (!submissionResult?.tripHash) return;
    navigator.clipboard.writeText(submissionResult.tripHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const ecoScoreValue = submissionResult ? submissionResult.ecoScore.score : tripData.eco_score;
  const ecoGrade = submissionResult ? submissionResult.ecoScore.grade : tripData.eco_grade;
  const ecoGradeTitle = submissionResult ? submissionResult.ecoScore.gradeTitle : tripData.eco_grade_title;
  const profileUsed = submissionResult ? submissionResult.ecoScore.profileUsed : tripData.profile_used;
  const rushHourApplied = submissionResult ? submissionResult.ecoScore.rushHourApplied : false;

  const tokensEarned = submissionResult ? submissionResult.tokenReward.totalReward : tripData.tokens_earned;
  const co2Avoided = submissionResult ? submissionResult.co2AvoidedKg : tripData.esg_co2_avoided_kg;
  const displayHash = submissionResult ? submissionResult.tripHash : tripData.trip_hash;
  const verificationStatus = submissionResult ? submissionResult.verificationStatus : tripData.verification_status;

  const bd: EcoScoreBreakdown = submissionResult ? submissionResult.ecoScore.breakdown : {
    baseScore: 100,
    harshAccelPenalty: tripData.telemetry_summary.harsh_accelerations * 5,
    harshBrakePenalty: tripData.telemetry_summary.harsh_brakings * 5,
    idlePenalty: (tripData.telemetry_summary.idle_duration_seconds / 60) * 1.5,
    gapPenalty: 0,
    overspeedPenalty: 0,
    cleanDrivingBonus: 0,
    totalPenalty: 10,
    totalBonus: 0,
    finalScore: tripData.eco_score,
  };

  const ts = finalTelemetry ?? {
    harshAccelCount: tripData.telemetry_summary.harsh_accelerations,
    harshBrakeCount: tripData.telemetry_summary.harsh_brakings,
    idleDurationSec: tripData.telemetry_summary.idle_duration_seconds,
    maxSpeedKmh: tripData.telemetry_summary.max_speed_kmh,
    tripDurationSec: 3600,
  };

  const isSynced = submissionResult?.verificationStatus === 'VERIFIED';
  const hasEndPhoto = Boolean(endPhotoEvidence?.odometerPhoto && endPhotoEvidence?.batteryPhoto);

  if (showPhotoCapture) {
    return (
      <CameraCapture
        onCapture={handlePhotoCapture}
        onCancel={handlePhotoCancel}
        title="Bukti Fisik Akhir Trip"
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 pb-20 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="text-center py-2 mb-2">
        <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-medium flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Trip Selesai
        </span>
        <h1 className="text-xl font-semibold text-white tracking-tight mt-0.5">
          Ringkasan Eco-Driving
        </h1>
        <p className="text-xs text-zinc-500 font-mono">
          {tripData.trip_id} • {tripData.license_plate}
        </p>
      </div>

      {/* ECO SCORE CARD */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`relative w-16 h-16 rounded-full bg-zinc-900 border-2 flex flex-col items-center justify-center ${
              ecoScoreValue >= 85 ? 'border-emerald-500/90'
                : ecoScoreValue >= 70 ? 'border-amber-500/90'
                : 'border-red-500/90'
            }`}>
              <span className="text-xl font-bold font-mono text-white leading-none">{ecoScoreValue}</span>
              <span className="text-[9px] font-mono text-zinc-400">/100</span>
            </div>
            <div>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-800/50 mb-1">
                {ecoGrade}
              </div>
              <h2 className="text-sm font-medium text-white">{ecoGradeTitle}</h2>
              <span className="text-[11px] text-zinc-500">
                {profileUsed === 'HIGHWAY_NORMAL' ? 'Highway' : 'Urban'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Efisiensi</span>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {(calculatedKwhUsed / (calculatedDistance || 1) * 100).toFixed(1)} kWh/100km
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <TreeDeciduous className="w-3.5 h-3.5 text-emerald-400" /> CO₂ Dihindari
          </span>
          <span className="font-mono text-emerald-300 font-medium">+{co2Avoided} kg</span>
        </div>
      </div>

      {/* SCORE BREAKDOWN */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-200 mb-2">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Rincian Skor
          </span>
        </div>
        <div className="space-y-1 text-[11px] font-mono">
          <div className="flex justify-between text-zinc-300">
            <span>Base</span>
            <span className="text-white font-medium">{bd.baseScore}</span>
          </div>
          {bd.harshAccelPenalty > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Harsh Accel ({ts.harshAccelCount}x)</span>
              <span className="text-amber-400">−{bd.harshAccelPenalty}</span>
            </div>
          )}
          {bd.harshBrakePenalty > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Harsh Brake ({ts.harshBrakeCount}x)</span>
              <span className="text-red-400">−{bd.harshBrakePenalty}</span>
            </div>
          )}
          {bd.idlePenalty > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Idle ({(ts.idleDurationSec / 60).toFixed(1)}m)</span>
              <span className="text-zinc-300">−{bd.idlePenalty}</span>
            </div>
          )}
          {bd.cleanDrivingBonus > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Clean Bonus</span>
              <span className="text-emerald-400">+{bd.cleanDrivingBonus}</span>
            </div>
          )}
          <div className="border-t border-zinc-800 my-1"></div>
          <div className="flex justify-between text-zinc-200 font-medium">
            <span>Total</span>
            <span className={ecoScoreValue >= 85 ? 'text-emerald-400' : ecoScoreValue >= 70 ? 'text-amber-400' : 'text-red-400'}>
              {ecoScoreValue}/100
            </span>
          </div>
        </div>
      </div>

      {/* REWARDS */}
      <div className="bg-zinc-950 border border-amber-500/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">BrigaCoins</h3>
              <p className="text-[10px] text-zinc-500">Reward eco-driving</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-amber-400 leading-none">+{tokensEarned}</span>
            <span className="block text-[10px] text-amber-300/80 font-mono">Coins</span>
          </div>
        </div>
        {submissionResult && (
          <div className="space-y-1.5 text-[11px] font-mono bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800/80">
            <div className="flex justify-between text-zinc-400">
              <span>Base ({calculatedDistance >= 15 ? '≥15' : '<15'} km)</span>
              <span className="text-zinc-200">+{submissionResult.tokenReward.baseReward}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Eco Multiplier ({submissionResult.tokenReward.ecoMultiplier}x)</span>
              <span className="text-emerald-400">+{submissionResult.tokenReward.multiplierReward}</span>
            </div>
            {submissionResult.tokenReward.streakBonus > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Streak Bonus</span>
                <span className="text-amber-400 font-medium">+{submissionResult.tokenReward.streakBonus}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DRIVER EARNINGS BREAKDOWN (Platform Fee Absorption Model) */}
      <div className="bg-zinc-950 border border-emerald-500/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Pendapatan Bersih Driver</h3>
              <p className="text-[10px] text-zinc-500">Transparansi bagi hasil & proteksi fee</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold font-mono text-emerald-400 leading-none">
              Rp {financialSplit.driverNetPayoutIdr.toLocaleString('id-ID')}
            </span>
            <span className="block text-[10px] text-emerald-300/80 font-mono">Net Payout</span>
          </div>
        </div>

        <div className="space-y-2 text-[11px] font-mono bg-zinc-900/80 p-3 rounded-lg border border-zinc-800/80">
          <div className="flex justify-between text-zinc-300">
            <span>Tarif Kotor Perjalanan</span>
            <span className="text-white font-medium">
              Rp {financialSplit.grossFareIdr.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="border-t border-zinc-800/80 pt-2 space-y-1">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Sumber Pembayaran Penumpang:
            </div>
            <div className="flex justify-between text-zinc-400 pl-2">
              <span>• Tunai / Dompet Digital</span>
              <span className="text-zinc-200">
                Rp {financialSplit.passengerPaidIdr.toLocaleString('id-ID')}
              </span>
            </div>
            {financialSplit.brcCoinsUsed > 0 && (
              <div className="flex justify-between text-zinc-400 pl-2">
                <span className="flex items-center gap-1 text-amber-300">
                  <Coins className="w-3 h-3 text-amber-400" />
                  Subsidi Voucher ({financialSplit.brcCoinsUsed} BRC)
                </span>
                <span className="text-amber-400 font-medium">
                  +Rp {financialSplit.brcSubsidyIdr.toLocaleString('id-ID')}
                </span>
              </div>
            )}
            {financialSplit.corporateSponsor && (
              <div className="flex items-center gap-1 text-[10px] text-cyan-400 pl-2">
                <Building2 className="w-3 h-3" />
                <span>Sponsor Korporat: {financialSplit.corporateSponsor}</span>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800/80 pt-2 space-y-1">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Kalkulasi Biaya Layanan Platform:
            </div>
            <div className="flex justify-between text-zinc-400 pl-2">
              <span>• Biaya Standar ({Math.round(financialSplit.standardPlatformFeeRate * 100)}%)</span>
              <span className="text-zinc-400">
                Rp {financialSplit.standardPlatformFeeIdr.toLocaleString('id-ID')}
              </span>
            </div>
            {financialSplit.platformSubsidyAbsorbedIdr > 0 && (
              <div className="flex justify-between text-zinc-400 pl-2">
                <span className="text-emerald-400 font-medium">
                  • Diserap Platform (Subsidi Voucher)
                </span>
                <span className="text-emerald-400 font-medium">
                  -Rp {financialSplit.platformSubsidyAbsorbedIdr.toLocaleString('id-ID')}
                </span>
              </div>
            )}
            <div className="flex justify-between text-zinc-300 pl-2 font-medium">
              <span>• Potongan Platform Efektif</span>
              <span className={financialSplit.effectivePlatformFeeIdr === 0 ? 'text-emerald-400' : 'text-zinc-200'}>
                Rp {financialSplit.effectivePlatformFeeIdr.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* DRIVER PROTECTION GUARANTEE BADGE */}
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-emerald-300 flex items-center gap-1">
              <span>Penghasilan Terlindungi Penuh</span>
              <Sparkles className="w-3 h-3 text-emerald-400" />
            </div>
            <p className="text-[10px] text-emerald-400/80 leading-relaxed">
              Diskon BRC penumpang ditanggung platform Drifee tanpa memotong tarif hak pengemudi.
            </p>
          </div>
        </div>
      </div>

      {/* VERIFICATION METRICS */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 mb-4 space-y-3">
        <div className="text-xs font-medium text-zinc-200">Verifikasi Akhir</div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/70">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
              <span className="flex items-center gap-1">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" /> SoC
              </span>
              <span className="text-emerald-400 font-mono font-medium">-{calculatedSocUsed}%</span>
            </div>
            <div className="flex items-baseline justify-between text-xs font-mono">
              <span className="text-zinc-500">{startSoc}%</span>
              <span className="text-white font-medium">{finalSoc}%</span>
            </div>
          </div>
          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/70">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
              <span className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Jarak
              </span>
              <span className="text-cyan-400 font-mono font-medium">{calculatedDistance} km</span>
            </div>
            <div className="flex items-baseline justify-between text-xs font-mono">
              <span className="text-zinc-500">{startOdo}</span>
              <span className="text-white font-medium">{finalOdo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SENSOR AUDIT */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 mb-4">
        <h4 className="text-xs font-medium text-zinc-200 uppercase tracking-wider mb-2 font-mono">
          Audit Sensor
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Harsh Accel</span>
            <span className="text-amber-400 font-medium">{ts.harshAccelCount}x</span>
          </div>
          <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Harsh Brake</span>
            <span className={`font-medium ${ts.harshBrakeCount === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {ts.harshBrakeCount}x
            </span>
          </div>
          <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Idle</span>
            <span className="text-zinc-300 font-medium">{(ts.idleDurationSec / 60).toFixed(1)}m</span>
          </div>
          <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">GPS Gaps</span>
            <span className="text-emerald-400 font-medium">
              {submissionResult?.serverResponse ? (submissionResult.serverResponse as any)?.verification_details?.gaps_interpolated : 0}
            </span>
          </div>
        </div>
      </div>

      {/* HASH */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 mb-5 font-mono">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            SHA-256 Hash
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
            verificationStatus === 'VERIFIED' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40'
            : verificationStatus === 'REJECTED' ? 'bg-red-950 text-red-400 border-red-800/40'
            : verificationStatus === 'QUEUED' ? 'bg-amber-950 text-amber-400 border-amber-800/40'
            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}>
            {isSubmitting ? 'VERIFYING' : verificationStatus === 'QUEUED' ? 'OFFLINE QUEUED' : verificationStatus}
          </span>
        </div>
        <div className="p-2 bg-zinc-900 rounded-lg text-[10px] text-zinc-400 break-all select-all flex items-center justify-between gap-2 border border-zinc-800">
          {isSubmitting ? (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
            </span>
          ) : (
            <span className="line-clamp-2">{displayHash}</span>
          )}
          <button
            onClick={copyTripHash}
            className="text-zinc-400 hover:text-emerald-400 shrink-0 p-1"
            disabled={isSubmitting || !displayHash}
          >
            {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        {submissionResult && verificationStatus === 'QUEUED' && (
          <div className="mt-2 text-[10px] text-amber-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Offline — trip disimpan ke antrian lokal. Akan dikirim otomatis saat koneksi kembali.
          </div>
        )}
        {submissionResult && verificationStatus === 'REJECTED' && (
          <div className="mt-2 text-[10px] text-red-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {submissionResult.errorMessage || 'Verification failed.'}
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="space-y-2">
        <div className={`flex items-center justify-between p-3 rounded-xl border ${
          hasEndPhoto
            ? 'bg-emerald-950/30 border-emerald-800/40'
            : 'bg-zinc-900/60 border-zinc-800/60'
        }`}>
          <div className="flex items-center gap-2">
            <Camera className={`w-4 h-4 ${hasEndPhoto ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span className={`text-xs font-medium ${hasEndPhoto ? 'text-emerald-300' : 'text-zinc-400'}`}>
              {hasEndPhoto ? 'Bukti foto akhir: OK' : 'Bukti foto akhir: Opsional'}
            </span>
          </div>
          {hasEndPhoto ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <button
              onClick={() => setShowPhotoCapture(true)}
              className="text-xs text-zinc-300 hover:text-emerald-300 font-medium"
            >
              Ambil (opsional)
            </button>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center space-x-2 text-xs transition-colors ${
            isSubmitting
              ? 'bg-zinc-800 text-zinc-400'
              : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Submit & Verify</span>
            </>
          )}
        </button>

        <button
          onClick={onStartNewTrip}
          className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Trip Baru</span>
        </button>
      </div>
    </div>
  );
}
