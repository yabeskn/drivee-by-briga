"use client";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Compass,
	Database,
	Eye,
	EyeOff,
	Flame,
	Fuel,
	MapPin,
	Moon,
	Navigation,
	QrCode,
	Radio,
	RotateCw,
	ShieldAlert,
	Sparkles,
	StopCircle,
	Sun,
	UserRound,
	WifiOff,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveProofCapture } from "@/components/LiveProofCapture";
import { useSilentWatchdog } from "@/hooks/useSilentWatchdog";
import { type TelematicsState, useTelematics } from "@/hooks/useTelematics";
import { calculateDynamicCO2Savings } from "@/lib/eco-score";
import { cleanupTelemetry } from "@/lib/telemetry-cleanup";
import { formatTime } from "@/lib/utils";
import type {
	EcoProfile,
	EVVehicle,
	PhotoEvidence,
	TripPhase,
	TripSecurityContext,
} from "@/types/telematics";

interface ActiveDrivingHUDProps {
	onEndTrip: (
		telemetry: TelematicsState,
		security: TripSecurityContext,
	) => void;
	tripId?: string;
	useLiveSensors?: boolean;
	/** Fase awal dari state machine (default DISPATCHED — langsung OTW jemput) */
	initialPhase?: TripPhase;
	/** Notifikasi perubahan fase ke state machine di parent */
	onPhaseChange?: (phase: TripPhase) => void;
	/** Mode simulasi desktop/e2e: watchdog tidak menandai anomali */
	simulateMode?: boolean;
	/**
	 * Kapasitas baterai (kWh) + SoC awal trip (%) — mengaktifkan
	 * estimasi daya/SoC per-titik telemetri sejak DISPATCHED.
	 */
	batteryCapacityKwh?: number;
	initialSoc?: number;
	/** Mode Uji Coba Mandiri (tanpa booking / verifikasi penumpang) */
	isTestDrive?: boolean;
	/** Kendaraan terpilih (BYD Atto 1, Yamaha X-Ride, dll) */
	vehicle?: EVVehicle;
}

export function ActiveDrivingHUD({
	onEndTrip,
	tripId = `trk_${Date.now()}`,
	useLiveSensors = true,
	initialPhase = "DISPATCHED",
	onPhaseChange,
	simulateMode = false,
	batteryCapacityKwh,
	initialSoc,
	isTestDrive = false,
	vehicle,
}: ActiveDrivingHUDProps) {
	const resolvedEvProfile =
		vehicle?.id === "veh_yamaha_xride_115"
			? "yamaha_xride_115"
			: vehicle?.id === "veh_byd_atto_1"
				? "byd_atto1"
				: undefined;

	const telemetry = useTelematics({
		tripId,
		enabled: useLiveSensors,
		useMockFallback: true,
		batteryCapacityKwh: vehicle?.powertrain === "ice" ? 0 : batteryCapacityKwh,
		initialSoc: vehicle?.powertrain === "ice" ? 100 : initialSoc,
		evProfile: resolvedEvProfile,
	});

	const [phase, setPhase] = useState<TripPhase>(initialPhase);
	const [proofEvidence, setProofEvidence] = useState<PhotoEvidence | null>(
		null,
	);
	// Snapshot jarak saat penumpang naik = deadhead miles (Scope 3 absolut)
	const deadheadDistanceRef = useRef<number | null>(null);
	const [ultraMinimalOled, setUltraMinimalOled] = useState(false);
	const [showSensorPanel, setShowSensorPanel] = useState(true);
	const [activeProfile, setActiveProfile] =
		useState<EcoProfile>("HIGHWAY_NORMAL");
	const [isOnline, setIsOnline] = useState(true);

	// Commuter Boarding Verification States
	const [showBoardingModal, setShowBoardingModal] = useState(false);
	const [boardingCodeInput, setBoardingCodeInput] = useState("");
	const [isVerifyingBoarding, setIsVerifyingBoarding] = useState(false);
	const [boardingError, setBoardingError] = useState<string | null>(null);
	const [boardedPassenger, setBoardedPassenger] = useState<{
		name: string;
		companyName?: string;
		discountBrc: number;
	} | null>(null);

	const handleVerifyBoardingCode = async () => {
		if (!boardingCodeInput.trim()) return;
		setIsVerifyingBoarding(true);
		setBoardingError(null);
		try {
			const res = await fetch("/api/commuter/board", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: boardingCodeInput.trim(), tripId }),
			});
			const json = await res.json();
			if (json.success && json.data) {
				setBoardedPassenger({
					name: json.data.passengerName || "Penumpang Komuter",
					companyName: json.data.companyName,
					discountBrc: json.data.discountBrc || 0,
				});
				deadheadDistanceRef.current = telemetry.tripDistanceKm;
				setPhase("PASSENGER_PICKED_UP");
				onPhaseChange?.("PASSENGER_PICKED_UP");
				setShowBoardingModal(false);
			} else {
				setBoardingError(json.error || "Kode boarding pass tidak valid");
			}
		} catch {
			setBoardingError("Gagal menghubungi server validasi");
		} finally {
			setIsVerifyingBoarding(false);
		}
	};

	const handleSkipBoardingCode = () => {
		setBoardedPassenger({ name: "Penumpang Retail / Umum", discountBrc: 0 });
		deadheadDistanceRef.current = telemetry.tripDistanceKm;
		setPhase("PASSENGER_PICKED_UP");
		onPhaseChange?.("PASSENGER_PICKED_UP");
		setShowBoardingModal(false);
	};

	useEffect(() => {
		const updateOnlineStatus = () => setIsOnline(navigator.onLine);
		updateOnlineStatus();
		window.addEventListener("online", updateOnlineStatus);
		window.addEventListener("offline", updateOnlineStatus);
		return () => {
			window.removeEventListener("online", updateOnlineStatus);
			window.removeEventListener("offline", updateOnlineStatus);
		};
	}, []);

	// ══ Invisible Security: watchdog diam-diam (2 menit pertama) ══
	// Modal LiveProofCapture HANYA dirender saat ANOMALY_DETECTED.
	const handleAnomaly = useCallback(() => {
		// Tidak perlu setState tambahan — status watchdog sudah memicu render modal
	}, []);

	const watchdog = useSilentWatchdog({
		enabled:
			useLiveSensors &&
			(phase === "DISPATCHED" || phase === "PASSENGER_PICKED_UP"),
		gpsSpeedKmh: telemetry.speedKmh > 0 ? telemetry.speedKmh : null,
		simulateMode,
		onAnomaly: handleAnomaly,
	});

	const isProofLocked =
		watchdog.status === "ANOMALY_DETECTED" && !proofEvidence;

	/** Freezer penuh: trip hanya bisa dilanjutkan setelah proof tervalidasi */
	const handleProofValidated = useCallback((evidence: PhotoEvidence) => {
		setProofEvidence(evidence);
	}, []);

	/** Kumpulkan konteks keamanan untuk payload verifikasi */
	const buildSecurityContext = useCallback(
		(): TripSecurityContext => ({
			watchdogFlagged: watchdog.status === "ANOMALY_DETECTED",
			watchdogReason: watchdog.reason,
			deadheadDistanceKm: deadheadDistanceRef.current ?? 0,
			proofEvidence,
			boardedPassenger,
		}),
		[watchdog.status, watchdog.reason, proofEvidence, boardedPassenger],
	);

	const toggleProfile = () => {
		setActiveProfile((p) =>
			p === "HIGHWAY_NORMAL" ? "URBAN_RUSH_HOUR" : "HIGHWAY_NORMAL",
		);
	};

	const speedDisplay = Math.round(telemetry.speedKmh);
	const speedLimitKmh = activeProfile === "HIGHWAY_NORMAL" ? 80 : 50;

	const liveEcoScore = useMemo(() => {
		const base = 100;
		const harshPenalty = telemetry.harshAccelCount * 3;
		const brakePenalty = telemetry.harshBrakeCount * 4;
		const idlePenaltyMins = Math.floor(telemetry.idleDurationSec / 300);
		return Math.max(50, base - harshPenalty - brakePenalty - idlePenaltyMins);
	}, [
		telemetry.harshAccelCount,
		telemetry.harshBrakeCount,
		telemetry.idleDurationSec,
	]);

	const liveCO2 = useMemo(() => {
		return calculateDynamicCO2Savings({
			distanceKm: telemetry.tripDistanceKm,
			ecoScore: liveEcoScore,
			powertrain: vehicle?.powertrain || "ev",
			vehicleType: vehicle?.vehicleType || "car",
			fuelType: vehicle?.fuelType || "pertalite",
			fuelConsumptionKmPerL: vehicle?.fuelConsumptionKmPerL,
		});
	}, [telemetry.tripDistanceKm, liveEcoScore, vehicle]);

	const pollingLabel =
		telemetry.pollingTier === "FAST"
			? "1.0 Hz"
			: telemetry.pollingTier === "MEDIUM"
				? "5s"
				: "15s";

	const phaseLabel: Record<TripPhase, string> = {
		IDLE: "Idle",
		DISPATCHED: isTestDrive ? "Uji Coba Bebas" : "OTW Jemput (Deadhead)",
		PASSENGER_PICKED_UP: "Penumpang di",
		COMPLETED: "Selesai",
	};

	const watchdogLabel: Record<string, string> = {
		IDLE: "OFF",
		RUNNING: `AKTIF ${Math.ceil((watchdog.remainingMs ?? 0) / 1000)}s`,
		CLEAN: "BERSIH",
		ANOMALY_DETECTED: "ANOMALI",
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
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={toggleProfile}
							className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono"
						>
							<span
								className={`w-1.5 h-1.5 rounded-full ${
									activeProfile === "HIGHWAY_NORMAL"
										? "bg-emerald-400"
										: "bg-cyan-400"
								}`}
							/>
							<span className="text-zinc-300 font-medium">
								{activeProfile === "HIGHWAY_NORMAL" ? "Highway" : "Urban"}
							</span>
						</button>

						{isTestDrive && (
							<div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-[10px] font-mono text-emerald-400">
								<Sparkles className="w-3 h-3 text-emerald-400" />
								<span>UJI TELEMETRI</span>
							</div>
						)}
					</div>

					<div className="flex items-center gap-1.5">
						<div
							className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-[10px] font-mono ${
								telemetry.wakeLockActive
									? "bg-emerald-950/50 border-emerald-800/50 text-emerald-400"
									: "bg-zinc-950 border-zinc-800 text-zinc-500"
							}`}
						>
							{telemetry.wakeLockActive ? (
								<Sun className="w-3 h-3" />
							) : (
								<Moon className="w-3 h-3" />
							)}
							<span>{telemetry.wakeLockActive ? "WAKE" : "SLEEP"}</span>
						</div>

						{!isOnline && (
							<div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-amber-950/50 border border-amber-800/50 text-[10px] font-mono text-amber-400">
								<WifiOff className="w-3 h-3" />
								<span>OFFLINE</span>
							</div>
						)}

						<button
							type="button"
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
							<span
								className={
									telemetry.isGpsLocked ? "text-zinc-300" : "text-red-400"
								}
							>
								{telemetry.isGpsLocked
									? `GPS (±${telemetry.accuracy.toFixed(1)}m)`
									: "Mencari GPS..."}
							</span>
						</div>
						<div className="flex items-center space-x-3">
							<span
								className={`flex items-center gap-1 ${telemetry.isAccelActive ? "text-emerald-400" : "text-zinc-600"}`}
							>
								<span
									className={`w-1.5 h-1.5 rounded-full ${telemetry.isAccelActive ? "bg-emerald-400" : "bg-zinc-700"}`}
								></span>
								{telemetry.isAccelActive ? "ACCEL" : "PAUSE"}
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
						{vehicle && (
							<span
								className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
									vehicle.powertrain === "ice"
										? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
										: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
								}`}
							>
								{vehicle.powertrain === "ice" ? (
									<Fuel className="w-3 h-3" />
								) : (
									<Zap className="w-3 h-3" />
								)}
								<span className="font-semibold truncate max-w-[130px]">
									{vehicle.name}
								</span>
							</span>
						)}
						<span
							className={`flex items-center gap-1 text-[10px] ${
								watchdog.status === "ANOMALY_DETECTED"
									? "text-red-400"
									: watchdog.status === "CLEAN"
										? "text-emerald-400"
										: "text-zinc-400"
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
							telemetry.drivingStatus === "harsh_accel"
								? "bg-amber-500"
								: telemetry.drivingStatus === "sudden_brake"
									? "bg-red-500"
									: "bg-emerald-500"
						}`}
					/>

					<div className="flex flex-col items-center z-10 text-center">
						<div className="flex items-baseline justify-center">
							<span
								className={`text-8xl sm:text-9xl font-bold font-mono tracking-tight transition-colors duration-300 ${
									ultraMinimalOled ? "text-zinc-300" : "text-white"
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
									speedDisplay > speedLimitKmh
										? "border-red-500"
										: "border-zinc-700"
								}`}
							>
								{speedLimitKmh}
							</div>
							<span className="text-[10px] font-mono text-zinc-400">
								{speedDisplay > speedLimitKmh ? "Batas terlampaui" : "Batas"}
							</span>
						</div>
					</div>
				</div>

				{/* Driving Status */}
				<div className="mt-6 w-full max-w-xs">
					<div
						className={`py-2 px-4 rounded-xl border flex items-center justify-between text-xs font-medium transition-colors ${
							telemetry.drivingStatus === "smooth"
								? "bg-zinc-950 border-emerald-500/50 text-emerald-300"
								: telemetry.drivingStatus === "harsh_accel"
									? "bg-zinc-950 border-amber-500 text-amber-300"
									: telemetry.drivingStatus === "sudden_brake"
										? "bg-zinc-950 border-red-500 text-red-300"
										: "bg-zinc-950 border-zinc-700 text-zinc-400"
						}`}
					>
						<div className="flex items-center space-x-2">
							{telemetry.drivingStatus === "smooth" && (
								<Sparkles className="w-4 h-4 text-emerald-400" />
							)}
							{telemetry.drivingStatus === "harsh_accel" && (
								<Flame className="w-4 h-4 text-amber-400" />
							)}
							{telemetry.drivingStatus === "sudden_brake" && (
								<ShieldAlert className="w-4 h-4 text-red-400" />
							)}
							{telemetry.drivingStatus === "idle" && (
								<Clock className="w-4 h-4 text-zinc-400" />
							)}
							<span>{telemetry.statusMessage}</span>
						</div>
						<span className="font-mono text-[11px] text-zinc-400">
							{telemetry.accelMagnitude > 0
								? telemetry.accelMagnitude.toFixed(1)
								: "0.0"}{" "}
							m/s²
						</span>
					</div>

					{/* Live CO2 Avoided Meter */}
					<div className="mt-2.5 flex flex-col items-center gap-1.5">
						<div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-xs font-mono text-emerald-300">
							<Sparkles className="w-3.5 h-3.5 text-emerald-400" />
							<span className="font-bold">
								+{liveCO2.totalAvoidedKg} kg CO₂
							</span>
							<span className="text-[10px] text-zinc-400 font-sans">
								{vehicle?.powertrain === "ice"
									? "reduksi habit"
									: "diselamatkan"}
							</span>
						</div>
						{vehicle?.powertrain === "ice" ? (
							<div className="flex items-center gap-2 text-[10px] font-mono text-amber-400 bg-zinc-950/90 px-2.5 py-0.5 rounded border border-amber-900/40">
								<span>
									⛽ Hemat: ~{Math.round(liveCO2.fuelSavedLiters * 1000)} mL
									Pertalite
								</span>
								{liveCO2.rupiahSaved && liveCO2.rupiahSaved > 0 ? (
									<span className="text-emerald-400 font-semibold">
										(Rp {liveCO2.rupiahSaved.toLocaleString("id-ID")})
									</span>
								) : null}
							</div>
						) : liveCO2.habitBonusSavingsKg > 0 ? (
							<span className="text-[10px] font-mono text-emerald-400 bg-zinc-900/90 px-2 py-0.5 rounded border border-zinc-800">
								Habit: +{liveCO2.habitBonusSavingsKg} kg
							</span>
						) : null}
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
							<span className="text-xl font-bold font-mono text-white">
								{liveEcoScore}
							</span>
							<span className="text-[10px] text-zinc-400 font-mono ml-1">
								/100
							</span>
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
							<p className="text-[10px] text-zinc-400 font-mono">
								{telemetry.tripDistanceKm} km
							</p>
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
							<p className="text-[10px] text-zinc-400 font-mono">
								{telemetry.pointsFlushed} flushed
							</p>
						</div>
					</div>
				</div>

				{showSensorPanel && !ultraMinimalOled && (
					<div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5">
						<div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-1.5">
							<span className="flex items-center gap-1">
								<Radio className="w-3 h-3 text-emerald-400" />
								SENSOR & KALIBRASI
							</span>
							<button
								type="button"
								onClick={() => setShowSensorPanel(false)}
								className="text-zinc-500 hover:text-zinc-300"
							>
								Tutup
							</button>
						</div>

						{/* Tare Mount Button */}
						<div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 mb-2">
							<div className="space-y-0.5">
								<div className="text-[10px] font-medium text-white flex items-center gap-1">
									<Compass className="w-3.5 h-3.5 text-cyan-400" />
									<span>Kalibrasi Posisi HP (Tare)</span>
								</div>
								<p className="text-[9px] text-zinc-400">
									{telemetry.isCalibrated
										? "✅ Posisi mount terkalibrasi"
										: "⚠️ Tekan Tare saat mobil berhenti"}
								</p>
							</div>
							<button
								type="button"
								onClick={() => telemetry.calibrateSensors?.()}
								className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-mono flex items-center gap-1 transition-colors"
							>
								<RotateCw className="w-3 h-3" />
								<span>Tare</span>
							</button>
						</div>

						<div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
							<div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
								<div className="flex justify-between items-center text-zinc-500">
									<span>GPS</span>
									<span
										className={`text-[9px] px-1 rounded ${
											telemetry.gpsQuality === "EXCELLENT"
												? "bg-emerald-950 text-emerald-400"
												: telemetry.gpsQuality === "GOOD"
													? "bg-amber-950 text-amber-400"
													: "bg-red-950 text-red-400"
										}`}
									>
										{telemetry.gpsQuality ?? "GPS"}
									</span>
								</div>
								<div className="text-zinc-200">
									{telemetry.lat.toFixed(5)}, {telemetry.lng.toFixed(5)}
								</div>
								<div className="text-zinc-400">
									±{telemetry.accuracy.toFixed(1)}m
								</div>
							</div>
							<div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
								<span className="text-zinc-500">G-FORCE (TERKALIBRASI)</span>
								<div className="text-zinc-200">
									X: {telemetry.calibratedAccelX ?? telemetry.accelX.toFixed(1)}{" "}
									Y: {telemetry.calibratedAccelY ?? telemetry.accelY.toFixed(1)}
								</div>
								<div className="text-zinc-400">
									Z: {telemetry.calibratedAccelZ ?? telemetry.accelZ.toFixed(1)}{" "}
									m/s²
								</div>
							</div>
							<div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
								<span className="text-zinc-500">POLL</span>
								<div className="text-zinc-200">
									{telemetry.pollingTier} ({telemetry.currentPollingMs}ms)
								</div>
							</div>
							<div className="bg-zinc-900/80 rounded-lg p-1.5 border border-zinc-800/60">
								<span className="text-zinc-500">EVENTS</span>
								<div className="text-zinc-200">
									<span className="text-amber-400">
										+{telemetry.harshAccelCount}
									</span>{" "}
									acc{" "}
									<span className="text-red-400">
										+{telemetry.harshBrakeCount}
									</span>{" "}
									brk
								</div>
							</div>
						</div>
					</div>
				)}

				<div className="pt-1">
					{!isTestDrive &&
						phase === "PASSENGER_PICKED_UP" &&
						boardedPassenger && (
							<div className="mb-2 p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-xs flex items-center justify-between">
								<div className="flex items-center gap-2">
									<UserRound className="w-4 h-4 text-cyan-400" />
									<div>
										<div className="font-semibold text-white">
											{boardedPassenger.name}
										</div>
										<div className="text-[10px] text-zinc-400">
											{boardedPassenger.companyName || "Penumpang Retail"}
										</div>
									</div>
								</div>
								{boardedPassenger.discountBrc > 0 && (
									<span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
										Diskon {boardedPassenger.discountBrc} BRC
									</span>
								)}
							</div>
						)}

					{!isTestDrive && phase === "DISPATCHED" && (
						<button
							type="button"
							onClick={() => {
								setShowBoardingModal(true);
							}}
							className="w-full py-3 px-4 mb-2 bg-cyan-600/90 hover:bg-cyan-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
						>
							<UserRound className="w-5 h-5" />
							<span>Penumpang Sudah Naik</span>
						</button>
					)}
					<button
						type="button"
						onClick={() => {
							// COMPLETED: hentikan SEMUA resource telematik (anti memory leak)
							cleanupTelemetry();
							onEndTrip(telemetry, buildSecurityContext());
						}}
						className="w-full py-3.5 px-4 bg-red-600/90 hover:bg-red-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
					>
						<StopCircle className="w-5 h-5" />
						<span>{isTestDrive ? "Selesaikan Uji Coba" : "Selesai Trip"}</span>
					</button>
				</div>
			</div>

			{/* MODAL VERIFIKASI BOARDING CODE PENUMPANG */}
			{showBoardingModal && (
				<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
						<div className="flex items-center justify-between border-b border-zinc-800 pb-3">
							<div className="flex items-center gap-2">
								<QrCode className="w-5 h-5 text-emerald-400" />
								<h3 className="text-sm font-bold text-white">
									Verifikasi Penumpang
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowBoardingModal(false)}
								className="text-zinc-500 hover:text-zinc-300 p-1"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						<p className="text-xs text-zinc-400">
							Masukkan 6-digit Boarding Code dari aplikasi Drifee penumpang
							untuk mengaktifkan subsidi komuter dan audit Scope 3:
						</p>

						<div className="space-y-2">
							<input
								type="text"
								value={boardingCodeInput}
								onChange={(e) => {
									setBoardingCodeInput(e.target.value.toUpperCase());
									setBoardingError(null);
								}}
								placeholder="BRG-XXX"
								maxLength={8}
								className="w-full text-center text-2xl font-mono font-bold tracking-widest px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-emerald-400 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
							/>

							{boardingError && (
								<div className="text-[11px] text-red-400 flex items-center gap-1.5 justify-center">
									<AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
									<span>{boardingError}</span>
								</div>
							)}
						</div>

						<div className="space-y-2 pt-2">
							<button
								type="button"
								onClick={handleVerifyBoardingCode}
								disabled={isVerifyingBoarding || !boardingCodeInput.trim()}
								className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-zinc-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
							>
								{isVerifyingBoarding ? (
									<span>Memvalidasi...</span>
								) : (
									<>
										<CheckCircle2 className="w-4 h-4" />
										<span>Validasi & Naikkan Penumpang</span>
									</>
								)}
							</button>

							<button
								type="button"
								onClick={handleSkipBoardingCode}
								className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-medium text-xs rounded-xl transition-colors"
							>
								Lewati (Penumpang Retail / Tanpa Kode)
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
