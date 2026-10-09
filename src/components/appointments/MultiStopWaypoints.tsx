"use client";

import { useState } from "react";
import type { TspOptimizationResult } from "@/lib/appointments/types";

export interface WaypointItem {
	id?: string;
	stop_name: string;
	address: string;
	lat: number;
	lng: number;
	contact_person?: string;
	contact_phone?: string;
	stop_notes?: string;
}

interface MultiStopWaypointsProps {
	pickupAddress: string;
	pickupLat: number;
	pickupLng: number;
	waypoints: WaypointItem[];
	maxWaypoints?: number;
	onChangePickup: (address: string, lat: number, lng: number) => void;
	onChangeWaypoints: (waypoints: WaypointItem[]) => void;
}

// Preset titik umum di koridor Jakarta - Cikarang untuk kemudahan input
const POPULAR_LOCATIONS = [
	{ name: "Bandara Soekarno-Hatta (Terminal 3)", lat: -6.1256, lng: 106.6559 },
	{ name: "Stasiun Kereta Cepat Whoosh Halim", lat: -6.2483, lng: 106.8839 },
	{ name: "Grand Wisata Bekasi", lat: -6.2848, lng: 107.0371 },
	{ name: "Lippo Cikarang Mall / Distrik 1", lat: -6.3312, lng: 107.1416 },
	{
		name: "Kawasan Industri MM2100 Cikarang Barat",
		lat: -6.2974,
		lng: 107.0984,
	},
	{ name: "Kawasan Industri GIIC / Deltamas", lat: -6.3688, lng: 107.1852 },
	{ name: "Jababeka Industrial Estate Phase 2", lat: -6.3056, lng: 107.1578 },
];

export function MultiStopWaypoints({
	pickupAddress,
	pickupLat,
	pickupLng,
	waypoints,
	maxWaypoints = 5,
	onChangePickup,
	onChangeWaypoints,
}: MultiStopWaypointsProps) {
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [optimizationResult, setOptimizationResult] =
		useState<TspOptimizationResult | null>(null);

	const handleAddWaypoint = () => {
		if (waypoints.length >= maxWaypoints) return;
		const nextPreset =
			POPULAR_LOCATIONS[(waypoints.length + 2) % POPULAR_LOCATIONS.length];
		const updated = [
			...waypoints,
			{
				id: `wp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
				stop_name: `Titik Singgah #${waypoints.length + 1}`,
				address: nextPreset.name,
				lat: nextPreset.lat,
				lng: nextPreset.lng,
				contact_person: "",
				contact_phone: "",
			},
		];
		onChangeWaypoints(updated);
		setOptimizationResult(null); // Reset optimization on edit
	};

	const handleRemoveWaypoint = (idx: number) => {
		const updated = waypoints.filter((_, i) => i !== idx);
		onChangeWaypoints(updated);
		setOptimizationResult(null);
	};

	const handleUpdateWaypoint = (
		idx: number,
		field: keyof WaypointItem,
		val: string | number,
	) => {
		const updated = [...waypoints];
		updated[idx] = { ...updated[idx], [field]: val };
		onChangeWaypoints(updated);
		setOptimizationResult(null);
	};

	// Jalankan TSP Route Optimization via API
	const handleOptimizeRoute = async () => {
		if (waypoints.length < 2) return;
		setIsOptimizing(true);

		try {
			const res = await fetch("/api/appointments/optimize-route", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					origin: {
						name: "Titik Jemput Awal",
						address: pickupAddress,
						lat: pickupLat,
						lng: pickupLng,
					},
					waypoints: waypoints.map((w) => ({
						name: w.stop_name,
						address: w.address,
						lat: w.lat,
						lng: w.lng,
					})),
				}),
			});

			const data = await res.json();
			if (data.success && data.data) {
				const result: TspOptimizationResult = data.data;
				setOptimizationResult(result);

				// Reorder local waypoints to match optimized TSP order (excluding origin at index 0)
				const reordered: WaypointItem[] = [];
				for (let i = 1; i < result.optimizedOrder.length; i++) {
					const optStop = result.optimizedOrder[i];
					const found = waypoints.find(
						(w) => w.lat === optStop.lat && w.lng === optStop.lng,
					);
					if (found) {
						reordered.push(found);
					}
				}

				if (reordered.length === waypoints.length) {
					onChangeWaypoints(reordered);
				}
			}
		} catch (e) {
			console.error("Gagal optimasi rute:", e);
		} finally {
			setIsOptimizing(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
					<span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
						3
					</span>
					Titik Penjemputan & Rute Perjalanan
				</h3>
				<span className="text-xs text-gray-500">
					Maks. {maxWaypoints} Titik Tambahan
				</span>
			</div>

			{/* Origin / Titik Jemput Awal */}
			<div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
						<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
						Titik Awal (Origin)
					</span>
					<span className="text-[11px] text-gray-400">
						Driver standby di sini
					</span>
				</div>
				<input
					type="text"
					value={pickupAddress}
					onChange={(e) => onChangePickup(e.target.value, pickupLat, pickupLng)}
					placeholder="Masukkan alamat lengkap penjemputan (misal: Apartemen/Stasiun/Lobi Hotel)..."
					className="w-full text-xs px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
				/>

				{/* Quick Presets */}
				<div className="flex flex-wrap gap-1.5 pt-1">
					<span className="text-[10px] text-gray-400 self-center">
						Pilihan Cepat:
					</span>
					{POPULAR_LOCATIONS.slice(0, 3).map((loc) => (
						<button
							key={loc.name}
							type="button"
							onClick={() => onChangePickup(loc.name, loc.lat, loc.lng)}
							className="text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-emerald-500 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md transition-colors"
						>
							{loc.name.split("(")[0]}
						</button>
					))}
				</div>
			</div>

			{/* Additional Waypoints List */}
			{waypoints.length > 0 && (
				<div className="space-y-2.5">
					{waypoints.map((wp, idx) => (
						<div
							key={wp.id || `wp-geo-${wp.lat}-${wp.lng}`}
							className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 relative"
						>
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
									<span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] flex items-center justify-center font-bold">
										{idx + 1}
									</span>
									Titik Singgah #{idx + 1}
								</span>
								<button
									type="button"
									onClick={() => handleRemoveWaypoint(idx)}
									className="text-[11px] text-red-500 hover:text-red-700 font-medium"
								>
									Hapus
								</button>
							</div>

							<input
								type="text"
								value={wp.address}
								onChange={(e) =>
									handleUpdateWaypoint(idx, "address", e.target.value)
								}
								placeholder="Alamat / nama gedung titik singgah..."
								className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 text-gray-900 dark:text-white"
							/>

							<div className="grid grid-cols-2 gap-2">
								<input
									type="text"
									value={wp.contact_person || ""}
									onChange={(e) =>
										handleUpdateWaypoint(idx, "contact_person", e.target.value)
									}
									placeholder="Nama PIC (opsional)"
									className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
								/>
								<input
									type="text"
									value={wp.contact_phone || ""}
									onChange={(e) =>
										handleUpdateWaypoint(idx, "contact_phone", e.target.value)
									}
									placeholder="No. WhatsApp PIC (opsional)"
									className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
								/>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Button Tambah Titik */}
			{waypoints.length < maxWaypoints && (
				<button
					type="button"
					onClick={handleAddWaypoint}
					className="w-full py-2.5 px-3 border border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-center gap-1.5"
				>
					<span>+</span> Tambah Titik Singgah / Jemput Rekan ({waypoints.length}
					/{maxWaypoints})
				</button>
			)}

			{/* TSP Route Optimization Action */}
			{waypoints.length >= 2 && (
				<div className="pt-1 space-y-2">
					<button
						type="button"
						onClick={handleOptimizeRoute}
						disabled={isOptimizing}
						className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
					>
						{isOptimizing ? (
							<span>Menghitung Rute Paling Hemat (OSRM TSP)...</span>
						) : (
							<>
								<svg
									className="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									role="img"
									aria-label="Route optimization icon"
								>
									<title>Ikon Optimasi Rute</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
									/>
								</svg>
								<span>
									Optimalkan Urutan Rute Otomatis (Hemat Baterai & Waktu)
								</span>
							</>
						)}
					</button>

					{/* Feedback Penghematan TSP */}
					{optimizationResult && (
						<div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-1">
							<div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
								<span>✓ Urutan Rute Berhasil Dioptimasi!</span>
							</div>
							<div className="grid grid-cols-3 gap-2 text-gray-700 dark:text-gray-300 pt-1 text-[11px]">
								<div>
									<span className="text-gray-400 block">Total Jarak:</span>
									<span className="font-bold">
										{optimizationResult.totalDistanceKm} km
									</span>
								</div>
								<div>
									<span className="text-gray-400 block">Jarak Dihemat:</span>
									<span className="font-bold text-emerald-600">
										+{optimizationResult.distanceSavedKm} km
									</span>
								</div>
								<div>
									<span className="text-gray-400 block">Emisi Ditekan:</span>
									<span className="font-bold text-teal-600">
										{optimizationResult.estimatedCo2AvoidedKg} kg CO₂
									</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
