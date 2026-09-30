"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { InstallBanner } from "@/components/InstallBanner";
import { BottomNav, type ScreenType } from "@/components/layout/BottomNav";
import { MobileShell } from "@/components/layout/MobileShell";
import { ActiveDrivingHUD } from "@/components/screens/ActiveDrivingHUD";
import { EndTripDashboard } from "@/components/screens/EndTripDashboard";
import { LoginVehicleScreen } from "@/components/screens/LoginVehicleScreen";
import type { TelematicsState } from "@/hooks/useTelematics";
import { TripStateMachine } from "@/lib/trip-state-machine";
import { supabase } from "@/lib/supabase/client";
import { registerServiceWorker, skipWaiting } from "@/lib/sw-register";
import { setupAutoSync } from "@/lib/sync/engine";
import type { EVVehicle, TripPhase, TripRecord, TripSecurityContext } from "@/types/telematics";

function GoApp() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeScreen, setActiveScreen] = useState<ScreenType>("login");
	const [isDrivingActive, setIsDrivingActive] = useState<boolean>(false);
	const [selectedVehicle, setSelectedVehicle] = useState<EVVehicle | null>(
		null,
	);
	const [currentTripData, setCurrentTripData] = useState<TripRecord | null>(
		null,
	);
	const [finalTelemetry, setFinalTelemetry] = useState<TelematicsState | null>(
		null,
	);
	const [securityContext, setSecurityContext] = useState<TripSecurityContext | null>(
		null,
	);
	const [tripStartTime, setTripStartTime] = useState<string>(
		new Date().toISOString(),
	);
	const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

	/**
	 * State machine trip: perekaman telematik (GPS, odometer, daya
	 * baterai) WAJIB menyala tepat pada transisi IDLE → DISPATCHED —
	 * deadhead miles (jarak kosong menuju titik jemput) adalah bagian
	 * integral emisi Scope 3 dan wajib masuk payload database.
	 */
	const [tripStateMachine] = useState(
		() =>
			new TripStateMachine({
				startTelemetryRecording: () => {
					// Telematik aktif = HUD dirender dengan enabled=true.
					// Dipanggil oleh state machine tepat saat dispatch().
					setIsDrivingActive(true);
				},
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
	);

	// Deteksi lingkungan tanpa sensor fisik (desktop/e2e) — watchdog
	// berjalan tapi tidak menandai anomali false-positive.
	const [simulateMode, setSimulateMode] = useState(false);
	useEffect(() => {
		const noMotion = typeof window !== "undefined" && !("DeviceMotionEvent" in window);
		const isTest =
			navigator.userAgent.includes("HeadlessChrome") ||
			new URLSearchParams(window.location.search).has("e2e");
		setSimulateMode(noMotion || isTest);
	}, []);

	// Check login status via Supabase Auth
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (!session?.user) {
				const screen = searchParams.get("screen");
				if (screen !== "login") {
					router.replace("/login");
				}
			}
		});
	}, [router, searchParams]);

	// Register service worker + auto-sync
	useEffect(() => {
		registerServiceWorker();
		const handleUpdate = () => setSwUpdateAvailable(true);
		window.addEventListener("sw-update-available", handleUpdate);
		const cleanupSync = setupAutoSync();
		return () => {
			window.removeEventListener("sw-update-available", handleUpdate);
			cleanupSync();
		};
	}, []);

	const handleStartTrip = (config: {
		vehicle: EVVehicle;
		startSoc: number;
		startOdo: number;
		corridor: string;
		geofence: { allowed: boolean; distanceMeters: number | null; reason: string };
	}) => {
		const tripId = `trip_${Date.now()}`;
		const initialTrip: TripRecord = {
			trip_id: tripId,
			driver_id:
				(typeof window !== "undefined" &&
					localStorage.getItem("drivee_driver_id")) ||
				"driver_demo",
			driver_name:
				(typeof window !== "undefined" &&
					localStorage.getItem("drivee_name")) ||
				"Driver",
			vehicle_id: config.vehicle.id,
			vehicle_name: config.vehicle.name,
			license_plate: config.vehicle.licensePlate,
			start_time: new Date().toISOString(),
			end_time: "",
			profile_used: "URBAN_RUSH_HOUR",
			start_battery_soc: config.startSoc,
			end_battery_soc: config.startSoc,
			start_odometer_km: config.startOdo,
			end_odometer_km: config.startOdo,
			distance_km: 0,
			energy_used_soc_percent: 0,
			energy_used_kwh: 0,
			telemetry_summary: {
				harsh_accelerations: 0,
				harsh_brakings: 0,
				idle_duration_seconds: 0,
				average_speed_kmh: 0,
				max_speed_kmh: 0,
				interpolated_gaps: 0,
			},
			eco_score: 100,
			eco_grade: "A+",
			eco_grade_title: "Eco Master",
			tokens_earned: 0,
			token_breakdown: {
				base_reward: 0,
				eco_multiplier: 1,
				multiplier_reward: 0,
				streak_bonus: 0,
				total_reward: 0,
			},
			trip_hash: "",
			verification_status: "PENDING",
			esg_co2_avoided_kg: 0,
		};
		setCurrentTripData(initialTrip);
		setSelectedVehicle(config.vehicle);
		setTripStartTime(new Date().toISOString());
		// ── Hard rule: transisi IDLE → DISPATCHED memulai perekaman ──
		void tripStateMachine.dispatch();
		setActiveScreen("hud");
	};

	const handlePhaseChange = (phase: TripPhase) => {
		if (phase === "PASSENGER_PICKED_UP" && tripStateMachine.currentPhase === "DISPATCHED") {
			tripStateMachine.pickUpPassenger();
		}
	};

	const handleEndTrip = (telemetry: TelematicsState, security: TripSecurityContext) => {
		// Transisi → COMPLETED pada state machine
		tripStateMachine.complete();
		setIsDrivingActive(false);
		setFinalTelemetry(telemetry);
		setSecurityContext(security);
		if (currentTripData) {
			setCurrentTripData({
				...currentTripData,
				end_time: new Date().toISOString(),
				distance_km: telemetry.tripDistanceKm,
				telemetry_summary: {
					harsh_accelerations: telemetry.harshAccelCount,
					harsh_brakings: telemetry.harshBrakeCount,
					idle_duration_seconds: telemetry.idleDurationSec,
					average_speed_kmh: telemetry.speedKmh,
					max_speed_kmh: telemetry.maxSpeedKmh,
					interpolated_gaps: 0,
				},
				trip_phase_timeline: tripStateMachine.getTimeline(),
			});
		}
		setActiveScreen("end-trip");
	};

	const handleStartNewTrip = () => {
		setActiveScreen("login");
		setFinalTelemetry(null);
		setSecurityContext(null);
	};

	const handleUpdateApp = async () => {
		await skipWaiting();
		window.location.reload();
	};

	return (
		<MobileShell
			activeScreen={activeScreen}
			isOledBlack={activeScreen === "hud"}
		>
			<div className="flex-1 flex flex-col w-full h-full">
				{activeScreen === "login" && (
					<LoginVehicleScreen onStartTrip={handleStartTrip} />
				)}

				{activeScreen === "hud" && currentTripData && (
					<ActiveDrivingHUD
						onEndTrip={handleEndTrip}
						tripId={currentTripData.trip_id}
						initialPhase={tripStateMachine.currentPhase}
						onPhaseChange={handlePhaseChange}
						simulateMode={simulateMode}
					/>
				)}

				{activeScreen === "end-trip" && currentTripData && (
					<EndTripDashboard
						tripData={{ ...currentTripData, start_time: tripStartTime }}
						finalTelemetry={finalTelemetry}
						onStartNewTrip={handleStartNewTrip}
						securityContext={securityContext}
					/>
				)}
			</div>

			<BottomNav
				currentScreen={activeScreen}
				onNavigate={(screen) => setActiveScreen(screen)}
				isDrivingActive={isDrivingActive}
			/>

			<InstallBanner />

			{swUpdateAvailable && (
				<div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
					<div className="bg-zinc-900 border border-emerald-700 rounded-xl p-3 shadow-lg flex items-center justify-between">
						<span className="text-sm text-zinc-200">Update available!</span>
						<button
							onClick={handleUpdateApp}
							className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
						>
							Update
						</button>
					</div>
				</div>
			)}
		</MobileShell>
	);
}

export default function GoPage() {
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const checkAuth = async () => {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (session && session.user && mounted) {
					localStorage.setItem("drivee_logged_in", "true");
					setIsAuthorized(true);
				} else {
					localStorage.removeItem("drivee_logged_in");
					if (mounted) {
						setIsAuthorized(false);
					}
				}
			} catch (err) {
				console.warn("Auth check error:", err);
				localStorage.removeItem("drivee_logged_in");
				if (mounted) {
					setIsAuthorized(false);
				}
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		checkAuth();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (session && session.user && mounted) {
				localStorage.setItem("drivee_logged_in", "true");
				setIsAuthorized(true);
			} else if (event === "SIGNED_OUT" || !session) {
				localStorage.removeItem("drivee_logged_in");
				if (mounted) {
					setIsAuthorized(false);
				}
			}
		});

		return () => {
			mounted = false;
			subscription.unsubscribe();
		};
	}, []);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-black flex items-center justify-center">
				<div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	if (!isAuthorized) {
		return (
			<div className="min-h-screen bg-black flex items-center justify-center">
				<div className="text-center">
					<p className="text-zinc-400 text-sm mb-4">Please login first</p>
					<a
						href="/login"
						className="text-emerald-400 hover:text-emerald-300 text-sm"
					>
						Go to Login
					</a>
				</div>
			</div>
		);
	}

	return <GoApp />;
}
