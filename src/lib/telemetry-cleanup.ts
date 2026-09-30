// ─────────────────────────────────────────────────────────────
// telemetry-cleanup.ts — Central Telemetry Resource Registry
//
// PWA ini menyala berjam-jam di ponsel pengemudi. Satu event
// listener atau watch geolocation yang tertinggal = kebocoran
// memori → browser crash. Fungsi cleanupTelemetry() adalah satu
// titik pembersihan yang dijamin tereksekusi penuh saat:
//   - trip selesai (COMPLETED)
//   - aplikasi di-background / pagehide / unmount
//
// Semua pemilik resource (useTelematics, useSilentWatchdog,
// modal kamera) WAJIB mendaftarkan resource di sini, bukan
// mengandalkan cleanup lokal semata.
// ─────────────────────────────────────────────────────────────

export type TelemetryResource = () => void;

interface RegistryState {
	resources: Map<number, TelemetryResource>;
	nextId: number;
	cleanedUp: boolean;
}

const registry: RegistryState = {
	resources: new Map(),
	nextId: 0,
	cleanedUp: false,
};

/**
 * Mendaftarkan fungsi cleanup (teardown) untuk satu resource
 * telematik (watch GPS, listener sensor, timer, stream kamera).
 *
 * @returns fungsi unregister — panggil saat resource sudah
 *          dihancurkan sendiri secara normal (mis. watch di-restart).
 */
export function registerTelemetryResource(
	cleanup: TelemetryResource,
): () => void {
	const id = ++registry.nextId;
	registry.resources.set(id, cleanup);
	return () => {
		registry.resources.delete(id);
	};
}

/**
 * Eksekusi SEMUA cleanup yang terdaftar lalu kosongkan registry.
 * Idempotent — aman dipanggil dua kali.
 */
export function cleanupTelemetry(): void {
	for (const cleanup of registry.resources.values()) {
		try {
			cleanup();
		} catch (err) {
			// Cleanup harus tidak pernah melempar — lanjutkan ke resource berikutnya
			console.warn("[telemetry-cleanup] Resource cleanup error:", err);
		}
	}
	registry.resources.clear();
	registry.cleanedUp = true;
}

/** Untuk testing — reset status registry. */
export function resetTelemetryRegistry(): void {
	registry.resources.clear();
	registry.cleanedUp = false;
}

/** Untuk testing/debugging — jumlah resource aktif saat ini. */
export function getActiveResourceCount(): number {
	return registry.resources.size;
}
