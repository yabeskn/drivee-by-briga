"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * WebNFC belum ada di lib.dom TypeScript. Deklarasikan hanya bentuk yang
 * benar-benar dipakai di sini — lebih baik daripada `any`, dan-direkomendasikan
 * juga oleh spesifikasi WebNFC.
 */
type NdefRecordLike = { recordType: string; data: ArrayBuffer };
type NdefReadingEvent = { message?: { records?: NdefRecordLike[] } };

export interface VehicleDetectorState {
	isNfcSupported: boolean;
	isScanning: boolean;
	detectedCode: string | null;
	error: string | null;
	sensorType: "nfc" | "qr" | "manual" | null;
}

export interface UseVehicleDetectorOptions {
	onDetected?: (vehicleCode: string, method: "nfc" | "qr") => void;
}

/**
 * Hook pendeteksi keberadaan kendaraan hybrid (Web NFC + QR Code)
 * Dirancang khusus untuk PWA Android Chrome / iOS Safari.
 */
export function useVehicleDetector(options?: UseVehicleDetectorOptions) {
	const [isNfcSupported, setIsNfcSupported] = useState<boolean>(false);
	const [isScanning, setIsScanning] = useState<boolean>(false);
	const [detectedCode, setDetectedCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sensorType, setSensorType] = useState<"nfc" | "qr" | "manual" | null>(
		null,
	);

	const abortControllerRef = useRef<AbortController | null>(null);
	const onDetectedRef = useRef(options?.onDetected);
	onDetectedRef.current = options?.onDetected;

	useEffect(() => {
		if (typeof window !== "undefined" && "NDEFReader" in window) {
			setIsNfcSupported(true);
		} else {
			setIsNfcSupported(false);
		}
	}, []);

	/**
	 * Mulai memindai Web NFC (NDEFReader)
	 */
	const startNfcScan = useCallback(async (): Promise<boolean> => {
		if (typeof window === "undefined" || !("NDEFReader" in window)) {
			setError("Web NFC tidak didukung pada browser/perangkat ini");
			return false;
		}

		try {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
			const controller = new AbortController();
			abortControllerRef.current = controller;

			const NdefReaderCtor = (
				window as unknown as {
					NDEFReader: new () => {
						scan(options?: { signal?: AbortSignal }): Promise<void>;
						onreading: ((event: NdefReadingEvent) => void) | null;
						onreadingerror: ((event: unknown) => void) | null;
					};
				}
			).NDEFReader;
			const ndef = new NdefReaderCtor();
			await ndef.scan({ signal: controller.signal });
			setIsScanning(true);
			setError(null);
			setSensorType("nfc");

			ndef.onreading = (event: NdefReadingEvent) => {
				try {
					const records = event.message?.records;
					if (records && records.length > 0) {
						const textDecoder = new TextDecoder();
						let parsedText = "";
						for (const record of records) {
							if (record.recordType === "text") {
								parsedText = textDecoder.decode(record.data);
								break;
							} else if (record.recordType === "url") {
								const url = textDecoder.decode(record.data);
								const match = url.match(/code=([a-zA-Z0-9_-]+)/i);
								if (match) parsedText = match[1];
								break;
							} else {
								parsedText = textDecoder.decode(record.data);
							}
						}

						const cleanCode = parsedText.trim();
						if (cleanCode) {
							setDetectedCode(cleanCode);
							setSensorType("nfc");
							if (onDetectedRef.current) {
								onDetectedRef.current(cleanCode, "nfc");
							}
						}
					}
				} catch (readErr) {
					setError(`Gagal membaca tag NFC: ${(readErr as Error).message}`);
				}
			};

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			ndef.onreadingerror = () => {
				setError("Tag NFC tidak terbaca atau format data tidak valid");
			};

			return true;
		} catch (err) {
			const msg =
				(err as Error).message || "Izin NFC ditolak atau dinonaktifkan";
			setError(msg);
			setIsScanning(false);
			return false;
		}
	}, []);

	/**
	 * Hentikan pemindaian NFC
	 */
	const stopNfcScan = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		setIsScanning(false);
	}, []);

	/**
	 * Menerima deteksi kode dari QR Scanner kamera
	 */
	const handleQrDetected = useCallback((code: string) => {
		const cleanCode = code.trim();
		if (cleanCode) {
			setDetectedCode(cleanCode);
			setSensorType("qr");
			setError(null);
			if (onDetectedRef.current) {
				onDetectedRef.current(cleanCode, "qr");
			}
		}
	}, []);

	/**
	 * Reset status deteksi
	 */
	const resetDetector = useCallback(() => {
		stopNfcScan();
		setDetectedCode(null);
		setError(null);
		setSensorType(null);
	}, [stopNfcScan]);

	useEffect(() => {
		return () => {
			stopNfcScan();
		};
	}, [stopNfcScan]);

	return {
		isNfcSupported,
		isScanning,
		detectedCode,
		error,
		sensorType,
		startNfcScan,
		stopNfcScan,
		handleQrDetected,
		resetDetector,
	};
}
