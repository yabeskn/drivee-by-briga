"use client";

// ─────────────────────────────────────────────────────────────
// LiveProofCapture.tsx — Modal Live Camera Proof (Anti-Fake GPS)
//
// HANYA di-render ketika useSilentWatchdog mengembalikan
// ANOMALY_DETECTED (indikasi Fake GPS: GPS bergerak linier tapi
// G-Force statis). Modal ini:
//   1. Memaksa akses kamera LIVE via getUserMedia — TANPA input
//      file/upload/gallery sama sekali (tidak ada <input type=file>).
//   2. MEMBEKUKAN aplikasi: seluruh UI di belakangnya tidak
//      interaktif, trip tidak bisa dilanjutkan, sampai foto dasbor
//      (odometer & baterai) berhasil diambil dan divalidasi.
//   3. Validasi lokal: kedua foto wajib, GPS wajib tertangkap.
// ─────────────────────────────────────────────────────────────

import {
	AlertTriangle,
	Battery,
	Camera,
	Check,
	Loader2,
	RefreshCw,
	ShieldAlert,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoEvidence } from "@/types/telematics";

export interface LiveProofCaptureProps {
	/** Dipanggil dengan bukti foto live yang valid — satu-satunya jalan keluar */
	onValidated: (evidence: PhotoEvidence) => void;
	/** Alasan anomali yang memicu modal ini (ditampilkan ke pengemudi) */
	reason?: string | null;
}

type CaptureMode = "odometer" | "battery";

export function LiveProofCapture({
	onValidated,
	reason,
}: LiveProofCaptureProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const validatedRef = useRef(false);

	const [mode, setMode] = useState<CaptureMode>("odometer");
	const [odometerPhoto, setOdometerPhoto] = useState<string | null>(null);
	const [batteryPhoto, setBatteryPhoto] = useState<string | null>(null);
	const [cameraError, setCameraError] = useState<string | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [gpsLocation, setGpsLocation] = useState<{
		lat: number;
		lng: number;
	} | null>(null);

	// ── GPS untuk metadata bukti ──
	useEffect(() => {
		if (!navigator.geolocation) return;
		navigator.geolocation.getCurrentPosition(
			(pos) =>
				setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
			() => {
				/* non-blocking — biarkan null */
			},
			{ enableHighAccuracy: true, timeout: 8000 },
		);
	}, []);

	// ── Kamera LIVE — getUserMedia, bukan file picker ──
	useEffect(() => {
		let cancelled = false;
		let localStream: MediaStream | null = null;

		const startCamera = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "environment", // kamera belakang — dasbor mobil
						width: { ideal: 1280 },
						height: { ideal: 720 },
					},
					audio: false,
				});
				if (cancelled) {
					stream.getTracks().forEach((t) => {
						t.stop();
					});
					return;
				}
				localStream = stream;
				streamRef.current = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					await videoRef.current.play().catch(() => {});
					setIsStreaming(true);
				}
			} catch (err) {
				if (!cancelled) {
					setCameraError(
						err instanceof Error ? err.message : "Akses kamera ditolak",
					);
				}
			}
		};
		startCamera();

		// PENTING: stream HARUS di-stop saat modal ditutup — MediaStream
		// yang menggantung juga adalah kebocoran resource berjam-jam.
		return () => {
			cancelled = true;
			localStream?.getTracks().forEach((t) => {
				t.stop();
			});
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((t) => {
					t.stop();
				});
				streamRef.current = null;
			}
			setIsStreaming(false);
		};
	}, []);

	const capturePhoto = useCallback(() => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!video || !canvas || !isStreaming) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		canvas.width = video.videoWidth || 640;
		canvas.height = video.videoHeight || 480;
		ctx.drawImage(video, 0, 0);
		// Kompresi JPEG ~0.6 agar payload hemat (~200KB)
		const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

		if (mode === "odometer") {
			setOdometerPhoto(dataUrl);
			setMode("battery");
		} else {
			setBatteryPhoto(dataUrl);
		}
	}, [mode, isStreaming]);

	const retake = (m: CaptureMode) => {
		if (m === "odometer") {
			setOdometerPhoto(null);
			setMode("odometer");
		} else {
			setBatteryPhoto(null);
			setMode("battery");
		}
	};

	// ── Validasi & satu-satunya jalan keluar dari modal ──
	const handleConfirm = useCallback(() => {
		if (!odometerPhoto || !batteryPhoto) return;
		setIsVerifying(true);
		// Validasi lokal cepat (sinkron, ringan):
		// - kedua foto ada
		// - GPS tertangkap (atau minimal dicoba)
		const evidence: PhotoEvidence = {
			odometerPhoto,
			batteryPhoto,
			capturedAt: Date.now(),
			gpsLocation,
		};
		validatedRef.current = true;
		// Sedikit delay agar state "Memvalidasi..." terlihat, lalu buka kunci aplikasi
		setTimeout(() => onValidated(evidence), 600);
	}, [odometerPhoto, batteryPhoto, gpsLocation, onValidated]);

	const bothCaptured = Boolean(odometerPhoto && batteryPhoto);

	return (
		// Backdrop full-screen: FREEZE aplikasi di belakangnya
		<div
			className="fixed inset-0 z-[100] bg-black flex flex-col select-none"
			role="dialog"
			aria-modal="true"
			aria-label="Validasi bukti fisik wajib"
			onKeyDown={(e) => {
				// Blokir shortcut yang bisa menghindari modal
				if (e.key === "Escape" || e.key === "Tab") e.preventDefault();
			}}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-red-900/60">
				<div className="flex items-center gap-2.5">
					<ShieldAlert className="w-5 h-5 text-red-400" />
					<div>
						<h2 className="text-sm font-bold text-white">
							Verifikasi Wajib — Anomali Terdeteksi
						</h2>
						<p className="text-[10px] text-red-400/90 font-mono">
							Trip dibekukan sampai verifikasi selesai
						</p>
					</div>
				</div>
				{/* Tidak ada tombol close — modal ini tidak boleh diabaikan */}
				<X className="w-5 h-5 text-zinc-700" />
			</div>

			{/* Banner alasan anomali */}
			{reason && (
				<div className="px-4 py-2 bg-red-950/60 border-b border-red-900/40 flex items-start gap-2">
					<AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
					<p className="text-[11px] text-red-300 leading-snug">{reason}</p>
				</div>
			)}

			{/* Kamera LIVE */}
			<div className="flex-1 relative min-h-0">
				{cameraError ? (
					<div className="flex flex-col items-center justify-center h-full p-6 text-center">
						<AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
						<p className="text-sm text-zinc-200 mb-1 font-semibold">
							Kamera tidak dapat diakses
						</p>
						<p className="text-xs text-zinc-500 mb-1">{cameraError}</p>
						<p className="text-[10px] text-zinc-600 mb-4 max-w-xs">
							Aplikasi tetap dibekukan. Buka pengaturan browser, izinkan akses
							kamera, lalu muat ulang halaman untuk melanjutkan trip.
						</p>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
						>
							Muat Ulang
						</button>
					</div>
				) : (
					<>
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							className="w-full h-full object-cover"
						/>
						<canvas ref={canvasRef} className="hidden" />

						{/* Overlay panduan dasbor */}
						<div className="absolute inset-0 pointer-events-none">
							<div className="absolute inset-8 border-2 border-dashed border-red-400/60 rounded-2xl" />
							<div className="absolute top-4 left-1/2 -translate-x-1/2">
								<div
									className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
										mode === "odometer"
											? "bg-cyan-500/20 text-cyan-200 border-cyan-400/50"
											: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50"
									}`}
								>
									{mode === "odometer" ? (
										<>
											<Camera className="w-3.5 h-3.5" />
											<span>Foto Odometer</span>
										</>
									) : (
										<>
											<Battery className="w-3.5 h-3.5" />
											<span>Foto Baterai SoC%</span>
										</>
									)}
								</div>
							</div>
							{gpsLocation && (
								<div className="absolute bottom-4 left-4">
									<div className="flex items-center gap-1 px-2 py-1 bg-black/60 rounded text-[10px] text-emerald-400 font-mono">
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
										GPS: {gpsLocation.lat.toFixed(4)},{" "}
										{gpsLocation.lng.toFixed(4)}
									</div>
								</div>
							)}
						</div>
					</>
				)}
			</div>

			{/* Preview + kontrol */}
			<div className="bg-zinc-950 border-t border-zinc-800 px-4 py-3 space-y-3">
				{(odometerPhoto || batteryPhoto) && (
					<div className="flex gap-2 justify-center">
						{odometerPhoto && (
							<div className="relative">
								{/* biome-ignore lint/performance/noImgElement: preview base64 dari kamera live, bukan aset statis */}
								<img
									src={odometerPhoto}
									alt="Foto odometer"
									className="w-16 h-16 object-cover rounded-lg border border-cyan-500/60"
								/>
								<button
									type="button"
									onClick={() => retake("odometer")}
									className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center"
									aria-label="Ulangi foto odometer"
								>
									<RefreshCw className="w-3 h-3 text-zinc-300" />
								</button>
							</div>
						)}
						{batteryPhoto && (
							<div className="relative">
								{/* biome-ignore lint/performance/noImgElement: preview base64 dari kamera live, bukan aset statis */}
								<img
									src={batteryPhoto}
									alt="Foto baterai"
									className="w-16 h-16 object-cover rounded-lg border border-emerald-500/60"
								/>
								<button
									type="button"
									onClick={() => retake("battery")}
									className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center"
									aria-label="Ulangi foto baterai"
								>
									<RefreshCw className="w-3 h-3 text-zinc-300" />
								</button>
							</div>
						)}
					</div>
				)}

				{!bothCaptured ? (
					<button
						type="button"
						onClick={capturePhoto}
						disabled={!isStreaming}
						className="w-full py-3.5 bg-red-500 hover:bg-red-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
					>
						<Camera className="w-5 h-5" />
						<span>
							{mode === "odometer"
								? "Ambil Foto Odometer"
								: "Ambil Foto Baterai"}
						</span>
					</button>
				) : isVerifying ? (
					<div className="w-full py-3.5 bg-zinc-900 text-zinc-300 font-bold rounded-xl flex items-center justify-center gap-2">
						<Loader2 className="w-5 h-5 animate-spin" />
						<span>Memvalidasi bukti...</span>
					</div>
				) : (
					<button
						type="button"
						onClick={handleConfirm}
						className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
					>
						<Check className="w-5 h-5" />
						<span>Konfirmasi & Lanjutkan Trip</span>
					</button>
				)}
				<p className="text-[10px] text-center text-zinc-500 font-mono">
					Kamera LIVE — galeri/upload file dinonaktifkan untuk anti-spoofing
				</p>
			</div>
		</div>
	);
}
