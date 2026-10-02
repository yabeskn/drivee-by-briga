"use client";

import {
	ArrowRight,
	BatteryCharging,
	Car,
	CheckCircle2,
	Compass,
	Gauge,
	Loader2,
	Lock,
	MapPin,
	Navigation,
	Phone,
	ShieldCheck,
	Sparkles,
	TriangleAlert,
	Radio,
	QrCode,
	Camera,
	Bluetooth,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { checkHubGeofence, type HubGeofenceResult } from "@/lib/geofence";
import { supabase } from "@/lib/supabase/client";
import type { EVVehicle } from "@/types/telematics";
import { SpeedometerCaptureModal } from "@/components/vehicle/SpeedometerCaptureModal";
import { VehicleScannerModal } from "@/components/vehicle/VehicleScannerModal";

const DEFAULT_VEHICLES: EVVehicle[] = [
	{
		id: "veh_wuling_air_ev",
		code: "EV-01",
		name: "Wuling Air EV Long Range",
		model: "Air EV (26.7 kWh)",
		licensePlate: "B 1234 EV",
		batteryCapacityKwh: 26.7,
		currentSoC: 88,
		estimatedRangeKm: 264,
		hubLocation: "Hub Cikarang Dry Port",
		status: "available",
		efficiencyKwhPer100Km: 10.1,
		category: "standard",
		seats: 4,
	},
	{
		id: "veh_hyundai_ioniq_5",
		code: "EV-02",
		name: "Hyundai Ioniq 5 Signature",
		model: "Ioniq 5 Long Range (72.6 kWh)",
		licensePlate: "B 5678 DRI",
		batteryCapacityKwh: 72.6,
		currentSoC: 92,
		estimatedRangeKm: 415,
		hubLocation: "Hub Halim Perdanakusuma",
		status: "available",
		efficiencyKwhPer100Km: 14.5,
		category: "professional",
		seats: 5,
	},
];

export interface ActiveDriverShift {
	shiftId: string;
	vehicle: EVVehicle;
	startTime: string;
	tripsCount: number;
	lastDropoffLocation?: { lat: number; lng: number };
	lastOdo: number;
	lastSoc: number;
}

interface LoginVehicleScreenProps {
	onStartTrip: (config: {
		vehicle: EVVehicle;
		startSoc: number;
		startOdo: number;
		corridor: string;
		/** Hasil validasi geofence Hub Briga.id (lolos saat Start Trip) */
		geofence: HubGeofenceResult;
	}) => void;
	activeShift?: ActiveDriverShift | null;
	onCheckoutShift?: () => void;
}

export function LoginVehicleScreen({ onStartTrip, activeShift, onCheckoutShift }: LoginVehicleScreenProps) {
	const [step, setStep] = useState<"auth" | "vehicle" | "ready">(() => {
		return activeShift ? "ready" : "auth";
	});
	const [phone, setPhone] = useState("");
	const [pin, setPin] = useState("");
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [selectedVehicle, setSelectedVehicle] = useState<EVVehicle | null>(() => {
		return activeShift?.vehicle ?? null;
	});
	const [vehicles, setVehicles] = useState<EVVehicle[]>(DEFAULT_VEHICLES);
	const [isCheckingGeofence, setIsCheckingGeofence] = useState(false);
	const [geofenceError, setGeofenceError] = useState<string | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session?.user) {
				setIsLoggedIn(true);
				if (!activeShift) {
					setStep("vehicle");
				}
				const driverName =
					session.user.user_metadata?.full_name ||
					session.user.email ||
					"Driver";
				if (typeof window !== "undefined") {
					localStorage.setItem("drivee_name", driverName);
					localStorage.setItem("drivee_driver_id", session.user.id);
				}
			}
		});
	}, [activeShift]);

	const [initialSoc, setInitialSoc] = useState<number>(() => {
		return activeShift?.lastSoc ?? 0;
	});
	const [initialOdo, setInitialOdo] = useState<number>(() => {
		return activeShift?.lastOdo ?? 0;
	});
	const [corridor, setCorridor] = useState("");
	const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
	const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
	const [aiVerifiedEvidence, setAiVerifiedEvidence] = useState<{
		odo: number;
		soc: number;
		image: string;
	} | null>(null);

	useEffect(() => {
		fetch('/api/admin/vehicles')
			.then((res) => res.json())
			.then((data) => {
				if (data.success && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
					setVehicles(data.vehicles);
				}
			})
			.catch(() => {});
	}, []);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (session?.user) {
			setIsLoggedIn(true);
			setStep("vehicle");
		} else {
			window.location.href = "/login";
		}
	};

	const handleSelectVehicle = (vehicle: EVVehicle) => {
		setSelectedVehicle(vehicle);
		setInitialSoc(vehicle.currentSoC);
		setStep("ready");
	};

	/**
	 * UX Anti-Friction: tombol Start Trip LANGSUNG memulai perjalanan
	 * (tanpa validasi manual/foto). Geofence Hub divalidasi secara
	 * ASYNCHRONOUS — penolakan hanya terjadi jika koordinat di luar
	 * radius Hub/Pool Briga.id.
	 */
	const handleConfirmStart = async () => {
		if (!selectedVehicle || isCheckingGeofence) return;
		setIsCheckingGeofence(true);
		setGeofenceError(null);
		try {
			const geofence = await checkHubGeofence({
				isSubsequentTrip: Boolean(activeShift),
				lastDropoffLocation: activeShift?.lastDropoffLocation,
			});
			if (!geofence.allowed) {
				setGeofenceError(
					`Trip ditolak: ${geofence.reason}. Pastikan armada berada di dalam wilayah koridor operasional resmi.`,
				);
				return;
			}
			onStartTrip({
				vehicle: selectedVehicle,
				startSoc: initialSoc,
				startOdo: initialOdo,
				corridor: corridor || geofence.corridorName || "Koridor Jabodetabek",
				geofence,
			});
		} catch (err) {
			setGeofenceError(
				`Validasi geofence gagal: ${(err as Error).message}`,
			);
		} finally {
			setIsCheckingGeofence(false);
		}
	};

	return (
		<div className="flex-1 flex flex-col p-4 pb-20 max-w-md mx-auto w-full">
			{/* Brand Header */}
			<div className="flex items-center justify-between py-3 mb-3 border-b border-zinc-900">
				<div className="flex items-center space-x-2">
					<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
						<svg viewBox="0 0 512 512" className="w-5 h-5">
							<rect width="512" height="512" rx="128" fill="#000000" />
							<circle
								cx="256"
								cy="256"
								r="200"
								fill="#052e16"
								stroke="#10b981"
								strokeWidth="12"
							/>
							<path
								d="M280 120L190 280H270L230 400L350 240H270L280 120Z"
								fill="#34d399"
							/>
							<path
								d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z"
								fill="none"
								stroke="#ffffff"
								strokeWidth="16"
								strokeLinejoin="round"
							/>
							<path
								d="M380 380 Q400 360 380 340 Q360 360 380 380"
								fill="#10b981"
							/>
						</svg>
					</div>
					<div>
						<h1 className="text-base font-semibold tracking-tight text-white">
							Drifee
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono font-normal ml-1.5">
								by Briga
							</span>
						</h1>
						<p className="text-[11px] text-zinc-500">
							Drive, Earn, and Track safely
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<a
						href="/commuter"
						className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-300 hover:text-white hover:border-emerald-500 transition-colors"
						title="Beralih ke Portal Penumpang / Komuter"
					>
						Mode Penumpang
					</a>
					{isLoggedIn && (
						<div className="flex items-center space-x-2 bg-zinc-900/80 px-2.5 py-1 rounded-full border border-zinc-800">
							<div className="w-2 h-2 rounded-full bg-emerald-400"></div>
							<span className="text-[11px] font-medium text-zinc-300 truncate max-w-[90px]">
								{localStorage.getItem("drivee_name") || "Driver"}
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Progress Steps */}
			<div className="grid grid-cols-4 gap-1.5 mb-5 select-none">
				<div
					className={`h-1.5 rounded-full ${step === "auth" ? "bg-emerald-400" : "bg-emerald-800"}`}
				/>
				<div
					className={`h-1.5 rounded-full ${step === "vehicle" ? "bg-emerald-400" : step === "ready" ? "bg-emerald-800" : "bg-zinc-800"}`}
				/>
				<div
					className={`h-1.5 rounded-full ${step === "ready" ? "bg-emerald-400" : "bg-zinc-800"}`}
				/>
				<div className="h-1.5 rounded-full bg-zinc-800" />
			</div>

			{/* STEP 1: AUTH */}
			{step === "auth" && (
				<div className="flex-1 flex flex-col justify-between">
					<div>
						<div className="mb-6">
							<span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
								Langkah 1 dari 4
							</span>
							<h2 className="text-xl font-semibold text-white mt-1">
								Login Driver
							</h2>
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
								<span>
									Driver:{" "}
									<strong className="text-white">
										{localStorage.getItem("drivee_name") || "Driver"}
									</strong>
								</span>
								<span className="text-emerald-400 font-mono">0 Coins</span>
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
			{step === "vehicle" && (
				<div className="flex-1 flex flex-col justify-between">
					<div>
						<div className="mb-4">
							<span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
								Langkah 2 dari 4
							</span>
							<h2 className="text-xl font-semibold text-white mt-1">
								Pilih Kendaraan
							</h2>
							<p className="text-xs text-zinc-500 mt-1">
								Pilih unit EV untuk shift Anda.
							</p>
						</div>

						{/* Auto-Detect Physical Vehicle Button */}
						<div className="mb-4">
							<button
								type="button"
								onClick={() => setIsScannerModalOpen(true)}
								className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs font-medium transition-colors"
							>
								<div className="flex items-center space-x-2">
									<Radio className="w-4 h-4 text-emerald-400" />
									<span>Deteksi Fisik Mobil (NFC / QR / Bluetooth)</span>
								</div>
								<span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
									Auto-Detect
								</span>
							</button>
						</div>

						<div className="space-y-3">
							{vehicles.length === 0 ? (
								<div className="text-center py-8">
									<p className="text-sm text-zinc-400 mb-4">
										No vehicles registered
									</p>
									<a
										href="/register/vehicle"
										className="inline-block px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
									>
										Register Vehicle
									</a>
								</div>
							) : (
								vehicles.map((vehicle) => {
									const isSelected = selectedVehicle?.id === vehicle.id;
									return (
										<div
											key={vehicle.id}
											onClick={() => handleSelectVehicle(vehicle)}
											className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
												isSelected
													? "bg-zinc-900 border-emerald-500"
													: "bg-zinc-900/60 border-zinc-800"
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
													<h3 className="text-sm font-medium text-white mt-1.5">
														{vehicle.name}
													</h3>
													<p className="text-[11px] text-zinc-500">
														{vehicle.model}
													</p>
												</div>

												<div className="text-right">
													<div className="flex items-center justify-end space-x-1 text-emerald-400 font-mono text-sm font-medium">
														<BatteryCharging className="w-4 h-4" />
														<span>{vehicle.currentSoC}%</span>
													</div>
													<span className="text-[10px] text-zinc-500">
														~{vehicle.estimatedRangeKm} km
													</span>
												</div>
											</div>

											<div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
												<div className="flex items-center gap-1">
													<MapPin className="w-3 h-3" />
													<span className="truncate max-w-[160px]">
														{vehicle.hubLocation}
													</span>
												</div>
												<div className="font-mono text-zinc-400">
													{vehicle.batteryCapacityKwh} kWh
												</div>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>

					<div className="pt-4 mt-6">
						<button
							onClick={() => setStep("ready")}
							className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors"
						>
							<span>Lanjut</span>
							<ArrowRight className="w-4 h-4" />
						</button>
					</div>
				</div>
			)}

			{/* STEP 3: PRE-DRIVE CHECK */}
			{step === "ready" && (
				<div className="flex-1 flex flex-col justify-between">
					<div>
						<div className="mb-4">
							<span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
								Langkah 3 dari 4
							</span>
							<h2 className="text-xl font-semibold text-white mt-1">
								Status Awal
							</h2>
							<p className="text-xs text-zinc-500 mt-1">
								Catat kondisi kendaraan sebelum perjalanan.
							</p>
						</div>

						{/* Active Shift Multi-Trip Banner */}
						{activeShift && (
							<div className="mb-4 p-3 bg-gradient-to-r from-emerald-500/15 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-xl flex items-center justify-between">
								<div className="flex items-center space-x-2.5">
									<div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
										#{activeShift.tripsCount + 1}
									</div>
									<div>
										<div className="text-white text-xs font-semibold flex items-center gap-1.5">
											<span>Trip Lanjutan (Shift Aktif)</span>
											<span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
												{activeShift.vehicle.code}
											</span>
										</div>
										<div className="text-[10px] text-zinc-400">
											Armada siap jalan • Lokasi jemput bebas koridor
										</div>
									</div>
								</div>
								{onCheckoutShift && (
									<button
										type="button"
										onClick={onCheckoutShift}
										className="text-[10px] text-zinc-400 hover:text-rose-400 font-medium underline underline-offset-2 transition-colors"
									>
										Selesai Shift
									</button>
								)}
							</div>
						)}

						<div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-4 flex items-center justify-between">
							<div>
								<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
									Kendaraan
								</span>
								<h4 className="text-sm font-medium text-white">
									{selectedVehicle?.name || "No vehicle selected"}
								</h4>
								<p className="text-xs font-mono text-emerald-400">
									{selectedVehicle?.licensePlate || "-"} •{" "}
									{selectedVehicle?.batteryCapacityKwh || 0} kWh
								</p>
							</div>
							<button
								onClick={() => setStep("vehicle")}
								className="text-xs text-zinc-400 hover:text-emerald-400 underline underline-offset-2"
							>
								Ganti
							</button>
						</div>

						{/* AI Speedometer Scan Trigger Button */}
						<div className="mb-4">
							<button
								type="button"
								onClick={() => setIsVisionModalOpen(true)}
								className="w-full py-3 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border border-emerald-500/40 hover:border-emerald-500 text-emerald-300 flex items-center justify-between text-xs font-semibold transition-all shadow-md group"
							>
								<div className="flex items-center space-x-2.5">
									<div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
										<Camera className="w-4 h-4" />
									</div>
									<div className="text-left">
										<div className="text-white text-xs font-semibold flex items-center gap-1.5">
											<span>Scan Speedometer AI</span>
											<Sparkles className="w-3 h-3 text-emerald-400" />
										</div>
										<div className="text-[10px] text-zinc-400 font-normal">
											Isi otomatis Odo & Baterai dari foto cluster
										</div>
									</div>
								</div>
								<span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
									Laya Vision
								</span>
							</button>
						</div>

						{aiVerifiedEvidence && (
							<div className="mb-4 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
								<div className="flex items-center space-x-2">
									<CheckCircle2 className="w-4 h-4 flex-shrink-0" />
									<span className="text-[11px] font-medium">
										Terverifikasi AI: Odo {aiVerifiedEvidence.odo.toLocaleString('id-ID')} km • Baterai {aiVerifiedEvidence.soc}%
									</span>
								</div>
								<span className="text-[10px] font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">
									Terkunci
								</span>
							</div>
						)}

						<div className="space-y-3.5 mb-5">
							<div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
								<label className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
									<span className="flex items-center gap-1.5">
										<BatteryCharging className="w-4 h-4 text-emerald-400" />
										Baterai (SoC %)
									</span>
									<span className="font-mono text-emerald-400 font-medium">
										{initialSoc}%
									</span>
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
									<span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">
										KM
									</span>
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

						{geofenceError && (
							<div className="bg-red-950/30 border border-red-900/50 rounded-xl p-3 mb-4">
								<div className="flex items-start gap-2">
									<TriangleAlert className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
									<div>
										<p className="text-xs font-medium text-red-300">
											Validasi Geofence Gagal
										</p>
										<p className="text-[10px] text-red-400/80 mt-0.5">
											{geofenceError}
										</p>
									</div>
								</div>
							</div>
						)}

						<div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 space-y-2 mb-4">
							<div className="flex items-center justify-between text-[11px]">
								<span className="text-zinc-400 flex items-center gap-1.5">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> GPS
								</span>
								<span className="text-emerald-400 font-mono font-medium">
									READY
								</span>
							</div>
							<div className="flex items-center justify-between text-[11px]">
								<span className="text-zinc-400 flex items-center gap-1.5">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
									Motion Sensor
								</span>
								<span className="text-emerald-400 font-mono font-medium">
									ACTIVE
								</span>
							</div>
							<div className="flex items-center justify-between text-[11px]">
								<span className="text-zinc-400 flex items-center gap-1.5">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
									WakeLock
								</span>
								<span className="text-emerald-400 font-mono font-medium">
									ENABLED
								</span>
							</div>
						</div>
					</div>

					<div className="pt-2">
						<button
							onClick={handleConfirmStart}
							disabled={isCheckingGeofence}
							className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-400 text-zinc-950 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors"
						>
							{isCheckingGeofence ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Navigation className="w-5 h-5" />
							)}
							<span>
								{isCheckingGeofence ? "Memvalidasi lokasi Hub..." : "Mulai Perjalanan"}
							</span>
						</button>
						<p className="text-[10px] text-center text-zinc-500 mt-2 font-mono">
							Tanpa validasi manual — telematik aktif otomatis sejak dispatch
						</p>
					</div>
				</div>
			)}

			{/* Vehicle Physical Scanner Modal (NFC / QR / Bluetooth) */}
			<VehicleScannerModal
				isOpen={isScannerModalOpen}
				onClose={() => setIsScannerModalOpen(false)}
				availableVehicles={vehicles}
				onVehicleSelected={(veh) => {
					handleSelectVehicle(veh);
				}}
			/>

			{/* Speedometer AI Vision Modal */}
			<SpeedometerCaptureModal
				isOpen={isVisionModalOpen}
				onClose={() => setIsVisionModalOpen(false)}
				vehicleCode={selectedVehicle?.code || "EV-01"}
				onSuccess={(result) => {
					setInitialOdo(result.odometerKm);
					setInitialSoc(result.batterySoc);
					setAiVerifiedEvidence({
						odo: result.odometerKm,
						soc: result.batterySoc,
						image: result.imageBase64,
					});
				}}
			/>
		</div>
	);
}
