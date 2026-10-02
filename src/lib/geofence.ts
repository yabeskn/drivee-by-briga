// ─────────────────────────────────────────────────────────────
// geofence.ts — Intelligent Fleet Geofence & Multi-Trip Corridor Engine
//
// Mendukung:
// 1. Validasi Hub Awal Shift (Desentralisasi Jabodetabek & Kawasan Industri)
// 2. Alur Multi-Trip Driver (Cikarang -> CGK -> PIK -> SCBD)
// 3. Deteksi & Perhitungan Jarak Deadhead (Antar Drop-off dan Pick-up berikutnya)
// ─────────────────────────────────────────────────────────────

export interface HubGeofenceResult {
	allowed: boolean;
	distanceMeters: number | null;
	reason: string;
	corridorName?: string;
	deadheadDistanceKm?: number;
}

export interface Hub {
	id: string;
	name: string;
	lat: number;
	lng: number;
	radiusMeters: number;
	zoneCategory?: 'airport' | 'business_district' | 'industrial' | 'transit_metro' | 'regional';
}

/**
 * Titik Simpul & Hub Spesifik Ekosistem Briga.id
 */
export const BRIGA_HUBS: Hub[] = [
	{
		id: "cikarang-dry-port",
		name: "Hub Cikarang Dry Port",
		lat: -6.30816,
		lng: 107.14987,
		radiusMeters: 5_000,
		zoneCategory: 'industrial',
	},
	{
		id: "halim",
		name: "Hub Halim Perdanakusuma",
		lat: -6.26652,
		lng: 106.89033,
		radiusMeters: 5_000,
		zoneCategory: 'airport',
	},
	{
		id: "soekarno-hatta-cgk",
		name: "Bandara Internasional Soekarno-Hatta (CGK)",
		lat: -6.1256,
		lng: 106.6559,
		radiusMeters: 15_000,
		zoneCategory: 'airport',
	},
	{
		id: "pantai-indah-kapuk-pik",
		name: "Kawasan Bisnis & Residensial PIK 1 & 2",
		lat: -6.1086,
		lng: 106.741,
		radiusMeters: 15_000,
		zoneCategory: 'business_district',
	},
	{
		id: "scbd-sudirman",
		name: "Kawasan Bisnis Segitiga Emas SCBD - Sudirman",
		lat: -6.2248,
		lng: 106.809,
		radiusMeters: 12_000,
		zoneCategory: 'business_district',
	},
	{
		id: "kiic-karawang",
		name: "Kawasan Industri KIIC & Suryacipta Karawang",
		lat: -6.345,
		lng: 107.28,
		radiusMeters: 25_000,
		zoneCategory: 'industrial',
	},
];

/**
 * Koridor Operasional Desentralisasi Luas
 * Mencakup seluruh aglomerasi Jabodetabek, Cikarang, dan Karawang.
 */
export const DECENTRALIZED_SERVICE_CORRIDORS: Hub[] = [
	{
		id: "koridor-jabodetabek-cikarang",
		name: "Koridor Layanan Utama Jabodetabek, Cikarang & Karawang",
		lat: -6.225,
		lng: 106.95,
		radiusMeters: 100_000, // 100 km mencakup dari Banten/CGK hingga Karawang Timur
		zoneCategory: 'regional',
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

/** Menghitung jarak Haversine dalam kilometer. */
export function haversineKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	return haversineMeters(lat1, lng1, lat2, lng2) / 1000;
}

/** Haversine distance helper (meter) untuk penggunaan umum. */
export function distanceMetersBetween(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	return haversineMeters(lat1, lng1, lat2, lng2);
}

/**
 * Menghitung jarak pergerakan kosong (Deadhead Distance) antara titik
 * drop-off trip sebelumnya dengan titik penjemputan trip berikutnya.
 */
export function calculateDeadheadKm(
	lastDropoff: { lat: number; lng: number } | null | undefined,
	currentPickup: { lat: number; lng: number },
): number {
	if (!lastDropoff || !lastDropoff.lat || !lastDropoff.lng) return 0;
	const distKm = haversineKm(lastDropoff.lat, lastDropoff.lng, currentPickup.lat, currentPickup.lng);
	return Number(distKm.toFixed(2));
}

export interface GeofenceOptions {
	/** Override daftar hub (untuk testing) */
	hubs?: Hub[];
	/** Timeout GPS dalam ms — default 10s */
	timeoutMs?: number;
	/** Izinkan koridor operasional desentralisasi (default true) */
	allowDecentralized?: boolean;
	/** Apakah ini trip lanjutan dalam shift aktif (bukan start shift awal)? */
	isSubsequentTrip?: boolean;
	/** Titik akhir drop-off trip sebelumnya (jika ada) */
	lastDropoffLocation?: { lat: number; lng: number } | null;
	/** Koordinat manual yang disuntikkan (berguna untuk testing / simulasi) */
	mockCoords?: { latitude: number; longitude: number; accuracy?: number };
}

/**
 * Validasi geofence cerdas multi-trip.
 * Mendukung start awal shift dan trip lanjutan (misal Cikarang -> CGK -> PIK -> SCBD).
 */
export async function checkHubGeofence(
	options: GeofenceOptions = {},
): Promise<HubGeofenceResult> {
	const allowDecentralized = options.allowDecentralized ?? true;
	const hubs = options.hubs ?? (allowDecentralized ? [...BRIGA_HUBS, ...DECENTRALIZED_SERVICE_CORRIDORS] : BRIGA_HUBS);
	const timeoutMs = options.timeoutMs ?? 10_000;

	// Ambil koordinat posisi saat ini
	let latitude: number;
	let longitude: number;
	let accuracy = 15;

	if (options.mockCoords) {
		latitude = options.mockCoords.latitude;
		longitude = options.mockCoords.longitude;
		accuracy = options.mockCoords.accuracy ?? 15;
	} else {
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

		latitude = position.coords.latitude;
		longitude = position.coords.longitude;
		accuracy = position.coords.accuracy || 15;
	}

	// ── Multi-Trip Logic: Hitung Deadhead jika ini trip lanjutan ──
	let deadheadDistanceKm = 0;
	if (options.isSubsequentTrip && options.lastDropoffLocation) {
		deadheadDistanceKm = calculateDeadheadKm(options.lastDropoffLocation, { lat: latitude, lng: longitude });
	}

	// Toleransi akurasi GPS
	const effectiveRadiusBonus = Math.min(accuracy || 0, 100);

	// Cari hub/koridor yang mencakup posisi saat ini (dist <= radius + bonus)
	let matchedHub: { hub: Hub; dist: number } | null = null;
	let nearestOverall: { hub: Hub; dist: number } | null = null;

	for (const hub of hubs) {
		const dist = haversineMeters(latitude, longitude, hub.lat, hub.lng);
		const isInside = dist <= hub.radiusMeters + effectiveRadiusBonus;

		if (!nearestOverall || dist < nearestOverall.dist) {
			nearestOverall = { hub, dist };
		}

		if (isInside) {
			// Prioritaskan hub simpul yang lebih spesifik (radius lebih kecil),
			// atau yang jarak pusatnya lebih dekat jika radiusnya sama
			if (
				!matchedHub ||
				hub.radiusMeters < matchedHub.hub.radiusMeters ||
				(hub.radiusMeters === matchedHub.hub.radiusMeters && dist < matchedHub.dist)
			) {
				matchedHub = { hub, dist };
			}
		}
	}

	if (!nearestOverall) {
		return {
			allowed: false,
			distanceMeters: null,
			reason: "Tidak ada koridor terdaftar",
		};
	}

	if (matchedHub) {
		const reason = options.isSubsequentTrip
			? `Trip lanjutan dalam radius ${matchedHub.hub.name}${deadheadDistanceKm > 0 ? ` (Deadhead: ${deadheadDistanceKm} km)` : ''}`
			: `Dalam radius ${matchedHub.hub.name}`;

		return {
			allowed: true,
			distanceMeters: Math.round(matchedHub.dist),
			reason,
			corridorName: matchedHub.hub.name,
			deadheadDistanceKm,
		};
	}

	return {
		allowed: false,
		distanceMeters: Math.round(nearestOverall.dist),
		reason: `Di luar radius semua wilayah layanan Drifee (${Math.round(nearestOverall.dist / 1000)} km dari ${nearestOverall.hub.name})`,
		corridorName: nearestOverall.hub.name,
		deadheadDistanceKm,
	};
}
