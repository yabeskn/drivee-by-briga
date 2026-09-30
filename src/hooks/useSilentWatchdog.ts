"use client";

// ─────────────────────────────────────────────────────────────
// useSilentWatchdog.ts — Invisible Security Module
//
// Membaca DeviceMotionEvent (akselerometer) dan
// DeviceOrientationEvent (magnetometer/kompas) secara "diam-diam"
// hanya selama 2 MENIT PERTAMA perjalanan, dengan throttling
// maksimal 2x per detik, tanpa memblokir Main UI Thread.
//
// Heuristik Fake GPS:
//   - GPS berubah LINIER (kecepatan konstan, heading konstan)
//     sedangkan G-Force akselerometer STATIS (variance ≈ 0) →
//     pengemudi kemungkinan memakai Fake GPS sambil diam di rumah
//     (telepon tergeletak, tidak bergetar sama sekali).
//   - Sensor motion tidak tersedia → juga dianggap anomali
//     (perangkat sungguhan yang melaju selalu punya getaran).
//
// Jika status menjadi ANOMALY_DETECTED, UI me-render modal
// LiveProofCapture untuk membekukan aplikasi sampai foto dasbor
// (odometer & baterai) divalidasi.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { registerTelemetryResource } from "@/lib/telemetry-cleanup";
import type { WatchdogStatus } from "@/types/telematics";

export type { WatchdogStatus };

// ── Konfigurasi (sesuai spesifikasi) ────────────────────────
const WATCHDOG_WINDOW_MS = 2 * 60 * 1000; // HANYA 2 menit pertama
const SENSOR_INTERVAL_MS = 500; // throttling maks 2x per detik
const THROTTLE_MIN_GAP_MS = 480; // jeda minimal antar-evaluasi (~2 Hz)

// Heuristik anomali
const STATIC_VARIANCE_THRESHOLD = 0.015; // variance G-force < ini → "statis"
const LINEAR_HEADING_VARIANCE_DEG = 6; // heading variance < ini → "linier"
const MIN_SAMPLES_FOR_JUDGEMENT = 8; // butuh ≥8 sampel (≈4 detik) sebelum menilai

export interface SilentWatchdogState {
	status: WatchdogStatus;
	/** Alasan anomali (untuk logging & UI) */
	reason: string | null;
	/** Sampel sensor yang sudah dikumpulkan */
	sampleCount: number;
	/** Sisa waktu window watchdog (ms) — null jika tidak berjalan */
	remainingMs: number | null;
}

export interface UseSilentWatchdogOptions {
	/** true saat trip aktif (DISPATCHED / PASSENGER_PICKED_UP) */
	enabled: boolean;
	/**
	 * Kecepatan GPS terkini (km/h) — dipakai untuk korelasi dengan
	 * sensor motion. Null/undefined berarti GPS belum lock.
	 */
	gpsSpeedKmh?: number | null;
	/**
	 * Mode simulasi (desktop/e2e tanpa sensor fisik): watchdog tetap
	 * berjalan tetapi TIDAK pernah menandai anomali — mencegah
	 * false-positive di lingkungan pengujian.
	 */
	simulateMode?: boolean;
	/**
	 * Callback saat status berubah menjadi ANOMALY_DETECTED.
	 * UI memakai ini untuk me-render LiveProofCapture.
	 */
	onAnomaly?: (reason: string) => void;
}

export interface SilentWatchdogApi extends SilentWatchdogState {
	/** Reset ke RUNNING ulang (mis. setelah proof divalidasi, terjadi trip baru) */
	reset: () => void;
}

export function useSilentWatchdog({
	enabled,
	gpsSpeedKmh,
	simulateMode = false,
	onAnomaly,
}: UseSilentWatchdogOptions): SilentWatchdogApi {
	const [status, setStatus] = useState<WatchdogStatus>("IDLE");
	const [reason, setReason] = useState<string | null>(null);
	const [sampleCount, setSampleCount] = useState(0);
	const [remainingMs, setRemainingMs] = useState<number | null>(null);

	// Refs — semua pekerjaan berat di ref, TIDAK memicu re-render
	const samplesRef = useRef<Array<{ mag: number; ts: number }>>([]);
	const headingRef = useRef<Array<{ heading: number; ts: number }>>([]);
	const accelVecRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
	const lastEvalRef = useRef(0);
	const anomalyRef = useRef(false);
	const lastReportedSpeedRef = useRef<number | null>(null);
	const speedStableCountRef = useRef(0);
	const onAnomalyRef = useRef(onAnomaly);
	onAnomalyRef.current = onAnomaly;
	// GPS speed via ref — mencegah effect re-run setiap tick GPS
	// (listener tidak boleh dipasang-ulang berulang kali)
	const gpsSpeedRef = useRef<number | null>(null);
	gpsSpeedRef.current = gpsSpeedKmh ?? null;
	const simulateModeRef = useRef(simulateMode);
	simulateModeRef.current = simulateMode;

	const reset = useCallback(() => {
		samplesRef.current = [];
		headingRef.current = [];
		accelVecRef.current = [];
		lastEvalRef.current = 0;
		anomalyRef.current = false;
		lastReportedSpeedRef.current = null;
		speedStableCountRef.current = 0;
		setStatus(enabled ? "RUNNING" : "IDLE");
		setReason(null);
		setSampleCount(0);
		setRemainingMs(enabled ? WATCHDOG_WINDOW_MS : null);
	}, [enabled]);

	// ── Evaluasi anomali (dipanggil via throttle, tidak sinkron-berat) ──
	const evaluate = useCallback(() => {
		const now = Date.now();
		if (now - lastEvalRef.current < THROTTLE_MIN_GAP_MS) return;
		lastEvalRef.current = now;

		const magSamples = samplesRef.current;
		if (magSamples.length < MIN_SAMPLES_FOR_JUDGEMENT) return;

		// 1. Variance magnitude G-force (statis vs bergetar)
		const mags = magSamples.map((s) => s.mag);
		const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
		const variance =
			mags.reduce((acc, m) => acc + (m - mean) ** 2, 0) / mags.length;

		// 2. Variance heading (kompas) — mobil bergerak nyata berbelok
		const headings = headingRef.current.map((h) => h.heading);
		let headingVariance = 0;
		if (headings.length >= MIN_SAMPLES_FOR_JUDGEMENT) {
			const hMean = headings.reduce((a, b) => a + b, 0) / headings.length;
			headingVariance =
				headings.reduce((acc, h) => acc + (h - hMean) ** 2, 0) /
				headings.length;
		}

		// 3. Stabilitas kecepatan GPS — fake GPS sering set kecepatan konstan
		const speed = gpsSpeedRef.current;
		const gpsMoving = speed != null && speed > 20;
		if (speed != null) {
			if (
				lastReportedSpeedRef.current != null &&
				Math.abs(speed - lastReportedSpeedRef.current) < 0.5
			) {
				speedStableCountRef.current += 1;
			} else {
				speedStableCountRef.current = 0;
			}
			lastReportedSpeedRef.current = speed;
		}

		// Keputusan anomali — semua kondisi ringan (aritmetika murni)
		if (simulateModeRef.current) return; // mode simulasi: tidak pernah anomali
		if (gpsMoving && variance < STATIC_VARIANCE_THRESHOLD) {
			// GPS mengatakan melaju >20 km/h tapi telepon benar-benar diam
			anomalyRef.current = true;
			setReason(
				`G-Force statis (variance ${variance.toFixed(4)}) sementara GPS melaju ${speed?.toFixed(0)} km/h — indikasi Fake GPS`,
			);
			setStatus("ANOMALY_DETECTED");
			onAnomalyRef.current?.(
				"G-Force statis saat GPS melaju — indikasi Fake GPS",
			);
			return;
		}

		if (
			gpsMoving &&
			speedStableCountRef.current >= MIN_SAMPLES_FOR_JUDGEMENT &&
			headingVariance < LINEAR_HEADING_VARIANCE_DEG ** 2
		) {
			// Kecepatan GPS linier sempurna + kompas tidak pernah berubah
			anomalyRef.current = true;
			setReason(
				"Kecepatan GPS linier sempurna & heading konstan tanpa getaran sensor — indikasi Fake GPS",
			);
			setStatus("ANOMALY_DETECTED");
			onAnomalyRef.current?.(
				"GPS linier + heading konstan tanpa sensor motion — indikasi Fake GPS",
			);
			return;
		}
	}, []);

	// ── Lifecycle utama ──
	useEffect(() => {
		if (!enabled) {
			setStatus("IDLE");
			setRemainingMs(null);
			return;
		}

		setStatus("RUNNING");
		setRemainingMs(WATCHDOG_WINDOW_MS);
		anomalyRef.current = false;

		// Deteksi dukungan sensor
		const hasMotion =
			typeof window !== "undefined" && "DeviceMotionEvent" in window;
		const hasOrientation =
			typeof window !== "undefined" && "DeviceOrientationEvent" in window;

		const unregisterCleanup = registerTelemetryResource(() => {
			// Fallback jika cleanupTelemetry() global dijalankan duluan:
			// handler di-scope di sini dan dilepas manual.
			window.removeEventListener("devicemotion", handleMotion);
			window.removeEventListener("deviceorientation", handleOrientation);
		});

		// Handler motion — ringan: hanya push ke ref + throttle evaluate
		const handleMotion = (e: DeviceMotionEvent) => {
			if (anomalyRef.current) return;
			const ag = e.accelerationIncludingGravity;
			if (!ag) return;
			const x = ag.x ?? 0;
			const y = ag.y ?? 0;
			const z = ag.z ?? 0;
			accelVecRef.current.push({ x, y, z });
			if (accelVecRef.current.length > 240) accelVecRef.current.shift();
			samplesRef.current.push({
				mag: Math.sqrt(x * x + y * y + z * z),
				ts: Date.now(),
			});
			if (samplesRef.current.length > 240) samplesRef.current.shift();
			evaluate();
		};

		// Handler orientation — kompas/magnetometer
		const handleOrientation = (e: DeviceOrientationEvent) => {
			if (anomalyRef.current) return;
			if (e.alpha == null) return;
			headingRef.current.push({ heading: e.alpha, ts: Date.now() });
			if (headingRef.current.length > 240) headingRef.current.shift();
		};

		if (hasMotion)
			window.addEventListener("devicemotion", handleMotion, { passive: true });
		if (hasOrientation)
			window.addEventListener("deviceorientation", handleOrientation, {
				passive: true,
			});

		// Tanpa sensor motion sama sekali → anomali langsung (tidak sinkron)
		// (diabaikan pada mode simulasi desktop/e2e)
		if (!hasMotion && !simulateModeRef.current) {
			const t = setTimeout(() => {
				anomalyRef.current = true;
				setReason(
					"DeviceMotion tidak tersedia — tidak dapat memverifikasi pergerakan fisik",
				);
				setStatus("ANOMALY_DETECTED");
				onAnomalyRef.current?.(
					"DeviceMotion tidak tersedia — indikasi emulator/fake environment",
				);
			}, MIN_SAMPLES_FOR_JUDGEMENT * SENSOR_INTERVAL_MS);
			registerTelemetryResource(() => clearTimeout(t));
		}

		// Tick UI ringan 1 Hz — hanya update remainingMs
		const uiTick = setInterval(() => {
			setRemainingMs((prev) => {
				const next = (prev ?? WATCHDOG_WINDOW_MS) - 1000;
				return next <= 0 ? 0 : next;
			});
		}, 1000);

		// Akhir window 2 menit → berhenti membaca sensor (aturan performa)
		const stopTimer = setTimeout(() => {
			if (!anomalyRef.current) {
				setStatus("CLEAN");
				setRemainingMs(0);
			}
			window.removeEventListener("devicemotion", handleMotion);
			window.removeEventListener("deviceorientation", handleOrientation);
			unregisterCleanup();
		}, WATCHDOG_WINDOW_MS);

		registerTelemetryResource(() => {
			clearInterval(uiTick);
			clearTimeout(stopTimer);
			setRemainingMs(null);
		});

		return () => {
			window.removeEventListener("devicemotion", handleMotion);
			window.removeEventListener("deviceorientation", handleOrientation);
			clearInterval(uiTick);
			clearTimeout(stopTimer);
			unregisterCleanup();
		};
		// gpsSpeedKmh sengaja tidak di dependency — dibaca via closure evaluate
		// yang selalu ter-update (evaluate direferensikan dari handler terbaru).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, evaluate]);

	return { status, reason, sampleCount, remainingMs, reset };
}
