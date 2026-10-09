"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db, type TelemetryPoint } from "@/lib/db";
import {
	type EvProfile,
	type EvProfileId,
	TelematicsEngine,
	validAccelDtSec,
} from "@/lib/telematics-physics";
import { registerTelemetryResource } from "@/lib/telemetry-cleanup";
import type { DrivingStatus } from "@/types/telematics";

// ─────────────────────────────────────────────────────────────
// CONSTANTS — Dynamic Polling Thresholds (PRD v1.1.0)
// ─────────────────────────────────────────────────────────────
const POLL_FAST_MS = 1_000; // >40 km/h  → 1 Hz
const POLL_MEDIUM_MS = 5_000; // <10 km/h  → 0.2 Hz
const POLL_IDLE_MS = 15_000; // 0 km/h >1min → 0.067 Hz
const IDLE_THRESHOLD_MS = 60_000; // durasi 0 km/h sebelum turun ke idle-poll

const BATCH_WRITE_INTERVAL_MS = 30_000; // flush ke IndexedDB tiap 30 detik

// FIX B3: Throttle display updates — max 0.5 Hz (every 2s)
// Reduces React re-renders from ~2/s to ~0.5/s, saving battery
const DISPLAY_THROTTLE_MS = 2_000;

// Driving-behaviour thresholds (m/s²) → HARSH_ACCEL_THRESHOLD /
// HARSH_BRAKE_THRESHOLD di "@/lib/telematics-physics"

// ─────────────────────────────────────────────────────────────
// Haversine distance — menghitung jarak dua titik GPS (km)
// ─────────────────────────────────────────────────────────────
function haversineKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371; // radius bumi km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// TYPES — hook return type
// ─────────────────────────────────────────────────────────────
export interface TelematicsState {
	// GPS
	lat: number;
	lng: number;
	accuracy: number;
	speedKmh: number;
	heading: number | null;
	altitude: number | null;
	isGpsLocked: boolean;

	// Accelerometer
	accelX: number;
	accelY: number;
	accelZ: number;
	accelMagnitude: number;
	isAccelActive: boolean;

	// Dynamic polling
	currentPollingMs: number;
	pollingTier: "FAST" | "MEDIUM" | "IDLE";
	zeroSpeedDurationMs: number;

	// Trip aggregate
	tripDistanceKm: number;
	tripDurationSec: number;
	maxSpeedKmh: number;
	pointsBuffered: number;
	pointsFlushed: number;
	lastFlushAt: number | null;

	// Driving behaviour
	drivingStatus: DrivingStatus;
	statusMessage: string;
	harshAccelCount: number;
	harshBrakeCount: number;
	idleDurationSec: number;

	// WakeLock
	wakeLockActive: boolean;

	// Baterai (estimasi per-titik sejak DISPATCHED)
	batterySoc: number | null; // SoC % terkini (estimasi integrasi daya)
	powerKw: number | null; // daya rata-rata kW sejak titik sebelumnya

	// Kalibrasi Sensor & G-Force
	isCalibrated?: boolean;
	calibratedAccelX?: number;
	calibratedAccelY?: number;
	calibratedAccelZ?: number;
	gpsQuality?: "EXCELLENT" | "GOOD" | "POOR";
	calibrateSensors?: () => void;

	// Errors
	sensorError: string | null;
}

/**
 * Meminta izin sensor gerak (akselerometer/giroskop) untuk iOS 13+
 */
export async function requestMotionPermission(): Promise<boolean> {
	if (
		typeof window !== "undefined" &&
		"requestPermission" in DeviceMotionEvent &&
		typeof (
			DeviceMotionEvent as unknown as {
				requestPermission?: () => Promise<string>;
			}
		).requestPermission === "function"
	) {
		try {
			const res = await (
				DeviceMotionEvent as unknown as {
					requestPermission: () => Promise<string>;
				}
			).requestPermission();
			return res === "granted";
		} catch (e) {
			console.warn("[useTelematics] Motion permission rejected:", e);
			return false;
		}
	}
	return true;
}

/**
 * Ekspor data log telemetri dari IndexedDB ke format CSV atau JSON
 */
export async function exportTelemetryData(
	tripId: string,
	format: "csv" | "json" = "csv",
): Promise<string> {
	const points = await db.telemetryPoints
		.where("tripId")
		.equals(tripId)
		.toArray();

	if (format === "json") {
		return JSON.stringify(points, null, 2);
	}

	const headers = [
		"timestamp_iso",
		"lat",
		"lng",
		"speed_kmh",
		"accuracy_m",
		"accel_x",
		"accel_y",
		"accel_z",
		"accel_magnitude",
		"driving_status",
		"battery_soc",
		"power_kw",
	];

	const rows = points.map((p) => [
		new Date(p.timestamp).toISOString(),
		p.lat,
		p.lng,
		p.speedKmh,
		p.accuracy,
		p.accelX,
		p.accelY,
		p.accelZ,
		p.accelMagnitude,
		p.drivingStatus,
		p.batterySoc ?? "",
		p.powerKw ?? "",
	]);

	return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

interface UseTelematicsOptions {
	tripId: string;
	enabled: boolean; // true saat trip aktif
	useMockFallback?: boolean; // fallback mock bila sensor tak tersedia
	/**
	 * Kapasitas baterai kendaraan (kWh) + SoC awal trip (%). Dengan
	 * keduanya, hook mengestimasi SoC & daya per-titik telemetri
	 * sejak DISPATCHED (disimpan ke telemetry_points.battery_soc / power_kw).
	 */
	batteryCapacityKwh?: number;
	initialSoc?: number;
	/** Profil EV untuk model daya road-load (default: byd_atto1). */
	evProfile?: EvProfileId | EvProfile;
}

// ─────────────────────────────────────────────────────────────
// HOOK — useTelematics
// ─────────────────────────────────────────────────────────────
export function useTelematics({
	tripId,
	enabled,
	useMockFallback = true,
	batteryCapacityKwh,
	initialSoc,
	evProfile,
}: UseTelematicsOptions): TelematicsState {
	// ── Public state ──────────────────────────────────────────
	const [state, setState] = useState<TelematicsState>({
		lat: 0,
		lng: 0,
		accuracy: 999,
		speedKmh: 0,
		heading: null,
		altitude: null,
		isGpsLocked: false,
		accelX: 0,
		accelY: 0,
		accelZ: 0,
		accelMagnitude: 0,
		isAccelActive: false,
		currentPollingMs: POLL_FAST_MS,
		pollingTier: "FAST",
		zeroSpeedDurationMs: 0,
		tripDistanceKm: 0,
		tripDurationSec: 0,
		maxSpeedKmh: 0,
		pointsBuffered: 0,
		pointsFlushed: 0,
		lastFlushAt: null,
		drivingStatus: "smooth",
		statusMessage: "Menunggu GPS Lock...",
		harshAccelCount: 0,
		harshBrakeCount: 0,
		idleDurationSec: 0,
		wakeLockActive: false,
		batterySoc: typeof initialSoc === "number" ? initialSoc : null,
		powerKw: null,
		isCalibrated: false,
		calibratedAccelX: 0,
		calibratedAccelY: 0,
		calibratedAccelZ: 0,
		gpsQuality: "POOR",
		calibrateSensors: () => {},
		sensorError: null,
	});

	// ── Refs (mutable state that doesn't trigger re-renders) ──
	const bufferRef = useRef<TelemetryPoint[]>([]);
	const prevPositionRef = useRef<{
		lat: number;
		lng: number;
		time: number;
	} | null>(null);
	const totalDistanceRef = useRef(0);
	const zeroSpeedStartRef = useRef<number | null>(null);
	const geoWatchIdRef = useRef<number | null>(null);
	const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const tripStartRef = useRef<number>(Date.now());
	const accelListenerRef = useRef<((e: DeviceMotionEvent) => void) | null>(
		null,
	);
	const isAccelPausedRef = useRef(false);
	const wakeLockRef = useRef<WakeLockSentinel | null>(null);
	const currentPollingRef = useRef(POLL_FAST_MS);
	const latestAccelRef = useRef({ x: 0, y: 0, z: 0, mag: 0 });
	const rawAccelRef = useRef({ x: 0, y: 0, z: 0 });
	const tareOffsetRef = useRef({ x: 0, y: 0, z: 0 });
	const isCalibratedRef = useRef(false);
	const harshAccelRef = useRef(0);
	const harshBrakeRef = useRef(0);
	const idleDurRef = useRef(0);
	const flushedCountRef = useRef(0);
	const prevSpeedRef = useRef(0);
	const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastRenderRef = useRef(0); // FIX B3: throttle display updates

	const calibrateSensors = useCallback(() => {
		const raw = rawAccelRef.current;
		tareOffsetRef.current = { x: raw.x, y: raw.y, z: raw.z };
		isCalibratedRef.current = true;
		setState((s) => ({
			...s,
			isCalibrated: true,
			calibratedAccelX: 0,
			calibratedAccelY: 0,
			calibratedAccelZ: 0,
		}));
	}, []);
	// Estimasi baterai per-titik — model road-load per EvProfile
	// (lihat telematics-physics.ts): P_roda = v·(m·a + m·g·Crr + ½·ρ·CdA·v²),
	// regen saat P_roda < 0 dibatasi etaRegen & maxRegen.
	const socRef = useRef<number | null>(
		typeof initialSoc === "number" ? initialSoc : null,
	);
	const lastSocSampleRef = useRef<{ ts: number; soc: number } | null>(null);

	// Opsi terkini disimpan di ref → callback sensor tidak stale closure
	const configRef = useRef({ batteryCapacityKwh, initialSoc, evProfile });
	configRef.current = { batteryCapacityKwh, initialSoc, evProfile };
	const engineRef = useRef<TelematicsEngine | null>(null);

	const makeEngine = useCallback(
		() =>
			new TelematicsEngine({
				profile: configRef.current.evProfile,
				batteryCapacityKwh: configRef.current.batteryCapacityKwh,
				initialSoc: configRef.current.initialSoc,
			}),
		[],
	);
	const batteryEnabled = useCallback(
		() =>
			typeof configRef.current.batteryCapacityKwh === "number" &&
			configRef.current.batteryCapacityKwh > 0 &&
			socRef.current != null,
		[],
	);

	// ── Determine polling interval from speed ─────────────────
	const resolvePollingInterval = useCallback(
		(
			speedKmh: number,
			zeroMs: number,
		): { intervalMs: number; tier: "FAST" | "MEDIUM" | "IDLE" } => {
			if (speedKmh > 40) return { intervalMs: POLL_FAST_MS, tier: "FAST" };
			if (speedKmh >= 10) return { intervalMs: POLL_FAST_MS, tier: "FAST" }; // 10-40 keep 1Hz
			if (speedKmh > 0) return { intervalMs: POLL_MEDIUM_MS, tier: "MEDIUM" };
			// speedKmh === 0
			if (zeroMs >= IDLE_THRESHOLD_MS)
				return { intervalMs: POLL_IDLE_MS, tier: "IDLE" };
			return { intervalMs: POLL_MEDIUM_MS, tier: "MEDIUM" };
		},
		[],
	);

	// ── WakeLock acquire / release ────────────────────────────
	const acquireWakeLock = useCallback(async () => {
		try {
			if ("wakeLock" in navigator) {
				const sentinel = await navigator.wakeLock.request("screen");
				wakeLockRef.current = sentinel;
				setState((s) => ({ ...s, wakeLockActive: true }));

				sentinel.addEventListener("release", () => {
					wakeLockRef.current = null;
					setState((s) => ({ ...s, wakeLockActive: false }));
					// Auto re-acquire if still enabled (e.g., after tab switch)
					if (enabled) {
						setTimeout(() => acquireWakeLock(), 500);
					}
				});
			}
		} catch {
			// WakeLock denied or unavailable — non-blocking
			// Retry after 30s if still enabled
			if (enabled) {
				setTimeout(() => acquireWakeLock(), 30_000);
			}
		}
	}, [enabled]);

	const releaseWakeLock = useCallback(() => {
		wakeLockRef.current?.release().catch(() => {});
		wakeLockRef.current = null;
		setState((s) => ({ ...s, wakeLockActive: false }));
	}, []);

	// ── Batch flush buffer → IndexedDB ────────────────────────
	const flushBuffer = useCallback(async () => {
		const batch = bufferRef.current.splice(0); // drain
		if (batch.length === 0) return;
		try {
			await db.telemetryPoints.bulkAdd(batch);
			flushedCountRef.current += batch.length;
			setState((s) => ({
				...s,
				pointsBuffered: bufferRef.current.length,
				pointsFlushed: flushedCountRef.current,
				lastFlushAt: Date.now(),
			}));
		} catch (err) {
			// Put items back on failure so they retry next cycle
			bufferRef.current.unshift(...batch);
			console.error("[useTelematics] IndexedDB flush failed:", err);
		}
	}, []);

	// ── DeviceMotion handler ──────────────────────────────────
	const handleDeviceMotion = useCallback((e: DeviceMotionEvent) => {
		if (isAccelPausedRef.current) return;
		const ag = e.accelerationIncludingGravity ?? e.acceleration;
		if (!ag) return;
		const rx = ag.x ?? 0;
		const ry = ag.y ?? 0;
		const rz = ag.z ?? 0;
		rawAccelRef.current = { x: rx, y: ry, z: rz };

		const cx = isCalibratedRef.current ? rx - tareOffsetRef.current.x : rx;
		const cy = isCalibratedRef.current ? ry - tareOffsetRef.current.y : ry;
		const cz = isCalibratedRef.current ? rz - tareOffsetRef.current.z : rz;
		const mag = Math.sqrt(cx * cx + cy * cy + cz * cz);
		latestAccelRef.current = { x: cx, y: cy, z: cz, mag };
	}, []);

	// ── Geolocation watch — satu watchPosition seumur trip ────
	// Browser yang menangani re-polling (hemat baterai & bebas
	// kebocoran setTimeout chain). clearWatch WAJIB dipanggil saat
	// trip selesai — didaftarkan ke registry global cleanup.
	const startGeoWatch = useCallback(() => {
		if (!enabled) return;

		// Prefer real GPS — fallback to mock if not available
		if (!navigator.geolocation) {
			setState((s) => ({
				...s,
				sensorError: "Geolocation API tidak tersedia di perangkat ini.",
			}));
			return;
		}

		geoWatchIdRef.current = navigator.geolocation.watchPosition(
			(pos) => {
				const now = Date.now();
				const { latitude, longitude, accuracy, speed, heading, altitude } =
					pos.coords;

				// Ambil posisi sebelumnya SEBELUM prevPositionRef di-update
				const prevPos = prevPositionRef.current;
				const dtSec = validAccelDtSec(prevPos?.time, now);

				// ── Calculate speed via Haversine (fallback when speed is null) ──
				let calculatedSpeedKmh = 0;
				if (speed != null && speed >= 0) {
					calculatedSpeedKmh = speed * 3.6; // m/s → km/h
				} else if (prevPos && dtSec != null) {
					const dist = haversineKm(
						prevPos.lat,
						prevPos.lng,
						latitude,
						longitude,
					);
					calculatedSpeedKmh = (dist / dtSec) * 3600;
				}
				// Noise filter — ignore spurious jumps when GPS accuracy is bad
				if (accuracy > 50 && calculatedSpeedKmh > 200)
					calculatedSpeedKmh = prevSpeedRef.current;
				calculatedSpeedKmh = Math.round(calculatedSpeedKmh * 10) / 10;

				// ── Accumulate trip distance ──
				if (prevPos && accuracy < 30) {
					const segmentKm = haversineKm(
						prevPos.lat,
						prevPos.lng,
						latitude,
						longitude,
					);
					if (segmentKm < 0.5) {
						// skip GPS jumps > 500m in one interval
						totalDistanceRef.current += segmentKm;
					}
				}
				prevPositionRef.current = { lat: latitude, lng: longitude, time: now };

				// ── Zero-speed tracking ──
				let zeroMs = 0;
				if (calculatedSpeedKmh < 1) {
					if (!zeroSpeedStartRef.current) zeroSpeedStartRef.current = now;
					zeroMs = now - zeroSpeedStartRef.current;
				} else {
					zeroSpeedStartRef.current = null;
				}

				// ── Dynamic polling recalculation ──
				const { intervalMs, tier } = resolvePollingInterval(
					calculatedSpeedKmh,
					zeroMs,
				);
				currentPollingRef.current = intervalMs;

				// ── Accelerometer pause/resume for deep idle ──
				const shouldPauseAccel = tier === "IDLE";
				if (shouldPauseAccel && !isAccelPausedRef.current) {
					isAccelPausedRef.current = true;
					setState((s) => ({ ...s, isAccelActive: false }));
				} else if (!shouldPauseAccel && isAccelPausedRef.current) {
					isAccelPausedRef.current = false;
					setState((s) => ({ ...s, isAccelActive: true }));
				}

				// ── Classify driving behaviour + energi (engine: dt nyata) ──
				const accel = latestAccelRef.current;
				engineRef.current ??= makeEngine();
				const engine = engineRef.current;
				const res = engine.ingest({
					timestampMs: now,
					speedKmh: calculatedSpeedKmh,
				});
				const { status: drivingStatus, statusMessage } = res;
				harshAccelRef.current = res.harshAccelCount;
				harshBrakeRef.current = res.harshBrakeCount;
				idleDurRef.current = res.idleDurationSec;

				prevSpeedRef.current = calculatedSpeedKmh;

				// ── Estimasi baterai per-titik (sejak DISPATCHED) ──
				const hasBattery = batteryEnabled();
				const pointSoc: number | null = hasBattery ? res.soc : null;
				const pointPowerKw: number | null = hasBattery ? res.powerKw : null;
				if (hasBattery && res.soc != null) {
					socRef.current = res.soc;
					lastSocSampleRef.current = { ts: now, soc: res.soc };
				}

				// ── Push telemetry point to in-memory buffer (always, unthrottled) ──
				const point: TelemetryPoint = {
					tripId,
					timestamp: now,
					lat: latitude,
					lng: longitude,
					accuracy,
					speedMps: speed ?? 0,
					speedKmh: calculatedSpeedKmh,
					heading: heading ?? null,
					altitude: altitude ?? null,
					accelX: accel.x,
					accelY: accel.y,
					accelZ: accel.z,
					accelMagnitude: accel.mag,
					pollingIntervalMs: intervalMs,
					isAccelPaused: isAccelPausedRef.current,
					drivingStatus,
					batterySoc: pointSoc,
					powerKw: pointPowerKw,
				};
				bufferRef.current.push(point);

				// ── FIX B3: Throttle React state updates (max 0.5 Hz) ──
				// Always force update on driving events (harsh accel/brake) for driver safety
				const isUrgent =
					drivingStatus === "harsh_accel" || drivingStatus === "sudden_brake";
				const timeSinceLastRender = now - lastRenderRef.current;

				if (isUrgent || timeSinceLastRender >= DISPLAY_THROTTLE_MS) {
					lastRenderRef.current = now;
					setState((s) => ({
						...s,
						lat: latitude,
						lng: longitude,
						accuracy,
						speedKmh: calculatedSpeedKmh,
						heading: heading ?? null,
						altitude: altitude ?? null,
						isGpsLocked: accuracy < 20,
						accelX: accel.x,
						accelY: accel.y,
						accelZ: accel.z,
						accelMagnitude: accel.mag,
						currentPollingMs: intervalMs,
						pollingTier: tier,
						zeroSpeedDurationMs: zeroMs,
						tripDistanceKm: Math.round(totalDistanceRef.current * 100) / 100,
						maxSpeedKmh: Math.max(s.maxSpeedKmh, calculatedSpeedKmh),
						pointsBuffered: bufferRef.current.length,
						drivingStatus,
						statusMessage,
						harshAccelCount: harshAccelRef.current,
						harshBrakeCount: harshBrakeRef.current,
						batterySoc: pointSoc,
						powerKw: pointPowerKw,
						idleDurationSec: Math.round(idleDurRef.current),
						isCalibrated: isCalibratedRef.current,
						calibratedAccelX: Math.round(accel.x * 100) / 100,
						calibratedAccelY: Math.round(accel.y * 100) / 100,
						calibratedAccelZ: Math.round(accel.z * 100) / 100,
						gpsQuality:
							accuracy <= 10 ? "EXCELLENT" : accuracy <= 25 ? "GOOD" : "POOR",
						calibrateSensors,
						sensorError: null,
					}));
				}
			},
			(err) => {
				setState((s) => ({
					...s,
					sensorError: `GPS Error (${err.code}): ${err.message}`,
					isGpsLocked: false,
				}));
				// watchPosition tetap aktif — browser otomatis retry
			},
			{
				enableHighAccuracy: true,
				timeout: 10_000,
				maximumAge: 0,
			},
		);

		// Daftarkan navigator.geolocation.clearWatch ke registry global —
		// dijamin tereksekusi oleh cleanupTelemetry() saat trip selesai
		// atau aplikasi di-unmount (pencegahan memory leak).
		registerTelemetryResource(() => {
			if (geoWatchIdRef.current != null) {
				navigator.geolocation.clearWatch(geoWatchIdRef.current);
				geoWatchIdRef.current = null;
			}
		});
	}, [
		enabled,
		tripId,
		resolvePollingInterval,
		makeEngine,
		batteryEnabled,
		calibrateSensors,
	]);

	// ── Mock sensor fallback (desktop / emulator) ─────────────
	const startMockSensors = useCallback(() => {
		let mockSpeed = 65;
		let mockLat = -6.2088;
		let mockLng = 106.8456;
		let tickCount = 0;

		mockIntervalRef.current = setInterval(() => {
			tickCount++;
			// Simulate varying speed patterns
			const phase = Math.sin(tickCount * 0.05);
			mockSpeed = Math.max(
				0,
				Math.round(55 + phase * 35 + (Math.random() - 0.5) * 10),
			);
			mockLat += (mockSpeed / 3600 / 111) * (currentPollingRef.current / 1000);
			mockLng +=
				(mockSpeed / 3600 / 111 / Math.cos((mockLat * Math.PI) / 180)) *
				(currentPollingRef.current / 1000) *
				0.3;

			const mockAccelX = (Math.random() - 0.5) * 2;
			const mockAccelY = (Math.random() - 0.5) * 1.5;
			const mockAccelZ = 9.8 + (Math.random() - 0.5) * 0.5;
			const mockMag = Math.sqrt(
				mockAccelX ** 2 + mockAccelY ** 2 + mockAccelZ ** 2,
			);

			latestAccelRef.current = {
				x: mockAccelX,
				y: mockAccelY,
				z: mockAccelZ,
				mag: mockMag,
			};

			const now = Date.now();

			// Distance
			if (prevPositionRef.current) {
				const seg = haversineKm(
					prevPositionRef.current.lat,
					prevPositionRef.current.lng,
					mockLat,
					mockLng,
				);
				if (seg < 0.5) totalDistanceRef.current += seg;
			}
			prevPositionRef.current = { lat: mockLat, lng: mockLng, time: now };

			// Zero speed tracking
			let zeroMs = 0;
			if (mockSpeed < 1) {
				if (!zeroSpeedStartRef.current) zeroSpeedStartRef.current = now;
				zeroMs = now - zeroSpeedStartRef.current;
			} else {
				zeroSpeedStartRef.current = null;
			}

			const { intervalMs, tier } = resolvePollingInterval(mockSpeed, zeroMs);
			currentPollingRef.current = intervalMs;

			const shouldPauseAccel = tier === "IDLE";
			isAccelPausedRef.current = shouldPauseAccel;

			// Engine bersama: dt nyata, harsh per kejadian, idle, daya & SoC
			engineRef.current ??= makeEngine();
			const engine = engineRef.current;
			const res = engine.ingest({ timestampMs: now, speedKmh: mockSpeed });
			const { status: drivingStatus, statusMessage } = res;
			harshAccelRef.current = res.harshAccelCount;
			harshBrakeRef.current = res.harshBrakeCount;
			idleDurRef.current = res.idleDurationSec;

			prevSpeedRef.current = mockSpeed;

			// Estimasi baterai per-titik (mock path — model sama)
			const hasBattery = batteryEnabled();
			const mockPointSoc: number | null = hasBattery ? res.soc : null;
			const mockPointPowerKw: number | null = hasBattery ? res.powerKw : null;
			if (hasBattery && res.soc != null) {
				socRef.current = res.soc;
				lastSocSampleRef.current = { ts: now, soc: res.soc };
			}

			// Buffer
			const point: TelemetryPoint = {
				tripId,
				timestamp: now,
				lat: mockLat,
				lng: mockLng,
				accuracy: 4.5,
				speedMps: mockSpeed / 3.6,
				speedKmh: mockSpeed,
				heading: 45,
				altitude: 25,
				accelX: mockAccelX,
				accelY: mockAccelY,
				accelZ: mockAccelZ,
				accelMagnitude: mockMag,
				pollingIntervalMs: intervalMs,
				isAccelPaused: isAccelPausedRef.current,
				drivingStatus,
				batterySoc: mockPointSoc,
				powerKw: mockPointPowerKw,
			};
			bufferRef.current.push(point);

			setState((s) => ({
				...s,
				lat: mockLat,
				lng: mockLng,
				accuracy: 4.5,
				speedKmh: mockSpeed,
				heading: 45,
				altitude: 25,
				isGpsLocked: true,
				accelX: mockAccelX,
				accelY: mockAccelY,
				accelZ: mockAccelZ,
				accelMagnitude: mockMag,
				isAccelActive: !shouldPauseAccel,
				currentPollingMs: intervalMs,
				pollingTier: tier,
				zeroSpeedDurationMs: zeroMs,
				tripDistanceKm: Math.round(totalDistanceRef.current * 100) / 100,
				maxSpeedKmh: Math.max(s.maxSpeedKmh, mockSpeed),
				pointsBuffered: bufferRef.current.length,
				drivingStatus,
				statusMessage,
				harshAccelCount: harshAccelRef.current,
				harshBrakeCount: harshBrakeRef.current,
				idleDurationSec: Math.round(idleDurRef.current),
				batterySoc: mockPointSoc,
				powerKw: mockPointPowerKw,
				isCalibrated: true,
				calibratedAccelX: Math.round(mockAccelX * 100) / 100,
				calibratedAccelY: Math.round(mockAccelY * 100) / 100,
				calibratedAccelZ: Math.round(mockAccelZ * 100) / 100,
				gpsQuality: "EXCELLENT",
				calibrateSensors,
				sensorError: "[MOCK] Sensor simulasi desktop aktif",
			}));
		}, 1000);
	}, [
		tripId,
		resolvePollingInterval,
		makeEngine,
		batteryEnabled,
		calibrateSensors,
	]);

	// ═══════════════════════════════════════════════════════════
	// LIFECYCLE — start / stop sensors
	// ═══════════════════════════════════════════════════════════
	useEffect(() => {
		if (!enabled) return;

		// Reset refs
		bufferRef.current = [];
		prevPositionRef.current = null;
		totalDistanceRef.current = 0;
		zeroSpeedStartRef.current = null;
		currentPollingRef.current = POLL_FAST_MS;
		isAccelPausedRef.current = false;
		harshAccelRef.current = 0;
		harshBrakeRef.current = 0;
		idleDurRef.current = 0;
		flushedCountRef.current = 0;
		prevSpeedRef.current = 0;
		tripStartRef.current = Date.now();
		engineRef.current = makeEngine();
		socRef.current =
			typeof configRef.current.initialSoc === "number"
				? configRef.current.initialSoc
				: null;

		// ── 1. WakeLock ──
		acquireWakeLock();

		// ── 2. Visibility change handler — re-acquire WakeLock ──
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && enabled) {
				acquireWakeLock();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);

		// ── 3. Check if real sensors are available ──
		const hasGeolocation = "geolocation" in navigator;
		const hasMotion = "DeviceMotionEvent" in window;

		if (hasGeolocation) {
			// ── 3a. Start GPS watch (clearWatch terdaftar di registry) ──
			startGeoWatch();

			// ── 3b. Start DeviceMotion listener ──
			if (hasMotion) {
				const handler = handleDeviceMotion;
				accelListenerRef.current = handler;
				window.addEventListener("devicemotion", handler, { passive: true });
				setState((s) => ({ ...s, isAccelActive: true }));
			}
		} else if (useMockFallback) {
			// ── 3c. Mock fallback for desktop testing ──
			startMockSensors();
		}

		// ── 4. Trip duration counter (synced with display throttle) ──
		durationTimerRef.current = setInterval(() => {
			setState((s) => ({
				...s,
				tripDurationSec: Math.round((Date.now() - tripStartRef.current) / 1000),
			}));
		}, DISPLAY_THROTTLE_MS);

		// ── 5. Batch-write timer → IndexedDB every 30s ──
		batchTimerRef.current = setInterval(flushBuffer, BATCH_WRITE_INTERVAL_MS);

		// ── 6. Anti memory-leak: flush + clearWatch saat app di-background ──
		// pagehide/fire/unload adalah satu-satunya event yang RELIABLE di PWA
		// mobile (visibilitychange tidak cukup untuk iOS Safari). Flush buffer
		// agar data tidak hilang, lalu clearWatch — watch akan di-restart
		// oleh effect ini saat aplikasi kembali aktif (re-mount).
		const handlePageHide = () => {
			flushBuffer();
			if (geoWatchIdRef.current != null) {
				navigator.geolocation.clearWatch(geoWatchIdRef.current);
				geoWatchIdRef.current = null;
			}
		};
		window.addEventListener("pagehide", handlePageHide);
		window.addEventListener("beforeunload", handlePageHide);
		registerTelemetryResource(() => {
			window.removeEventListener("pagehide", handlePageHide);
			window.removeEventListener("beforeunload", handlePageHide);
		});

		// ══ Cleanup ══
		return () => {
			// Stop GPS watch — navigator.geolocation.clearWatch WAJIB dieksekusi
			if (geoWatchIdRef.current != null) {
				navigator.geolocation.clearWatch(geoWatchIdRef.current);
				geoWatchIdRef.current = null;
			}

			// Stop batch-write timer
			if (batchTimerRef.current) clearInterval(batchTimerRef.current);
			batchTimerRef.current = null;

			// Stop duration timer
			if (durationTimerRef.current) clearInterval(durationTimerRef.current);
			durationTimerRef.current = null;

			// Stop mock interval
			if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
			mockIntervalRef.current = null;

			// Remove DeviceMotion listener
			if (accelListenerRef.current) {
				window.removeEventListener("devicemotion", accelListenerRef.current);
				accelListenerRef.current = null;
			}

			// Remove visibility change listener
			document.removeEventListener("visibilitychange", handleVisibilityChange);

			// Remove pagehide listeners
			window.removeEventListener("pagehide", handlePageHide);
			window.removeEventListener("beforeunload", handlePageHide);

			// Final flush — write remaining buffer to DB
			flushBuffer();

			// Release WakeLock
			releaseWakeLock();
		};
	}, [
		enabled,
		acquireWakeLock,
		handleDeviceMotion,
		useMockFallback,
		startMockSensors,
		startGeoWatch,
		flushBuffer,
		releaseWakeLock,
		makeEngine,
	]);

	return state;
}
