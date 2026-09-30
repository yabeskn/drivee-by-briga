// ─────────────────────────────────────────────────────────────
// geofence.ts — Invisible Security: Hub Geofence Validation
//
// Saat tombol "Start Trip" ditekan, koordinat driver divalidasi
// secara ASYNCHRONOUS terhadap radius Hub/Pool Briga.id.
// Perjalanan ditolak jika di luar radius — tanpa memblokir
// Main UI Thread (semua I/O async, tanpa busy-wait).
// ─────────────────────────────────────────────────────────────

export interface HubGeofenceResult {
	allowed: boolean;
	distanceMeters: number | null;
	reason: string;
}

export interface Hub {
	id: string;
	name: string;
	lat: number;
	lng: number;
	radiusMeters: number;
}

/**
 * Daftar Hub/Pool Briga.id. Radius default 500 m.
 * Dalam produksi ini di-fetch dari Supabase; konstanta lokal
 * memastikan validasi tetap berjalan offline.
 */
export const BRIGA_HUBS: Hub[] = [
	{
		id: "cikarang-dry-port",
		name: "Hub Cikarang Dry Port",
		lat: -6.30816,
		lng: 107.14987,
		radiusMeters: 500,
	},
	{
		id: "halim",
		name: "Hub Halim Perdanakusuma",
		lat: -6.26652,
		lng: 106.89033,
		radiusMeters: 500,
	},
];

function haversineMeters(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371000;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Haversine distance helper (meter) untuk penggunaan lain. */
export function distanceMetersBetween(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	return haversineMeters(lat1, lng1, lat2, lng2);
}

interface GeofenceOptions {
	/** Override daftar hub (untuk testing) */
	hubs?: Hub[];
	/** Timeout GPS dalam ms — default 10s */
	timeoutMs?: number;
}

/**
 * Validasi geofence asinkron terhadap semua hub.
 * - Mengambil posisi via getCurrentPosition (async, tidak memblokir UI)
 * - allowed = true jika dalam radius salah satu hub
 * - Jika GPS gagal/timeout → allowed = false (fail-closed untuk security)
 */
export async function checkHubGeofence(
	options: GeofenceOptions = {},
): Promise<HubGeofenceResult> {
	const hubs = options.hubs ?? BRIGA_HUBS;
	const timeoutMs = options.timeoutMs ?? 10_000;

	if (typeof navigator === "undefined" || !navigator.geolocation) {
		return {
			allowed: false,
			distanceMeters: null,
			reason: "Geolocation API tidak tersedia",
		};
	}

	const position = await new Promise<GeolocationPosition | null>((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				resolve(null);
			}
		}, timeoutMs);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(pos);
				}
			},
			() => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(null);
				}
			},
			{ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
		);
	});

	if (!position) {
		return {
			allowed: false,
			distanceMeters: null,
			reason: "GPS tidak dapat menentukan lokasi (timeout atau ditolak)",
		};
	}

	const { latitude, longitude, accuracy } = position.coords;
	// Toleransi: akurasi GPS ditambahkan ke radius agar tidak menolak driver sah
	const effectiveRadiusBonus = Math.min(accuracy || 0, 100);

	let nearest: { hub: Hub; dist: number } | null = null;
	for (const hub of hubs) {
		const dist = haversineMeters(latitude, longitude, hub.lat, hub.lng);
		if (!nearest || dist < nearest.dist) nearest = { hub, dist };
	}

	if (!nearest) {
		return {
			allowed: false,
			distanceMeters: null,
			reason: "Tidak ada hub terdaftar",
		};
	}

	const within =
		nearest.dist <= nearest.hub.radiusMeters + effectiveRadiusBonus;
	return {
		allowed: within,
		distanceMeters: Math.round(nearest.dist),
		reason: within
			? `Dalam radius ${nearest.hub.name}`
			: `Di luar radius semua Hub Briga.id (${Math.round(nearest.dist)} m dari ${nearest.hub.name})`,
	};
}
