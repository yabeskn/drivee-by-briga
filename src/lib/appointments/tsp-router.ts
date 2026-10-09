// ─────────────────────────────────────────────────────────────
// appointments/tsp-router.ts — OSRM Traveling Salesperson (TSP) Router
//
// Menyelesaikan urutan rute multi-titik (waypoints) yang optimal
// untuk meminimalkan jarak tempuh total (km), menghemat baterai EV,
// dan menghitung reduksi emisi Scope 3 karbon.
// ─────────────────────────────────────────────────────────────

import { EV_CAR_CO2_SAVED_PER_KM } from "@/lib/corporate/commute";
import type { TspOptimizationResult, TspStopPoint } from "./types";

const OSRM_BASE_URL =
	process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

interface OsrmTripWaypoint {
	waypoint_index: number;
	trips_index: number;
	name: string;
	location: [number, number]; // [lng, lat]
}

interface OsrmTripResponse {
	code: string;
	waypoints: OsrmTripWaypoint[];
	trips: Array<{
		distance: number; // meters
		duration: number; // seconds
		geometry: {
			type: "LineString";
			coordinates: [number, number][]; // [lng, lat][]
		};
	}>;
}

/**
 * Menghitung jarak haversine sederhana (dalam km) antara 2 koordinat
 */
export function calculateHaversineDistanceKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const R = 6371; // Radius bumi dalam km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Fallback heuristik Nearest-Neighbor jika OSRM server offline/unreachable
 */
function solveTspHeuristic(
	origin: TspStopPoint,
	waypoints: TspStopPoint[],
	lockedDestination?: TspStopPoint | null,
): {
	optimized: TspStopPoint[];
	indices: number[];
	totalKm: number;
} {
	const unvisited = [...waypoints];
	const result: TspStopPoint[] = [origin];
	const indices: number[] = [0];

	let current = origin;
	while (unvisited.length > 0) {
		let nearestIdx = 0;
		let minDistance = Number.POSITIVE_INFINITY;

		for (let i = 0; i < unvisited.length; i++) {
			const d = calculateHaversineDistanceKm(
				current.lat,
				current.lng,
				unvisited[i].lat,
				unvisited[i].lng,
			);
			if (d < minDistance) {
				minDistance = d;
				nearestIdx = i;
			}
		}

		const nextPoint = unvisited.splice(nearestIdx, 1)[0];
		result.push(nextPoint);
		// Find original index
		const origIdx = waypoints.indexOf(nextPoint) + 1;
		indices.push(origIdx);
		current = nextPoint;
	}

	if (lockedDestination) {
		result.push(lockedDestination);
		indices.push(waypoints.length + 1);
	}

	// Calculate rough total KM
	let totalKm = 0;
	for (let i = 0; i < result.length - 1; i++) {
		totalKm += calculateHaversineDistanceKm(
			result[i].lat,
			result[i].lng,
			result[i + 1].lat,
			result[i + 1].lng,
		);
	}

	return { optimized: result, indices, totalKm };
}

/**
 * Optimalkan urutan titik perjalanan menggunakan OSRM /trip/v1/driving API
 */
export async function optimizeMultiStopRoute(
	origin: TspStopPoint,
	waypoints: TspStopPoint[],
	options?: {
		lockedDestination?: TspStopPoint | null;
		roundTrip?: boolean;
	},
): Promise<TspOptimizationResult> {
	const allStops: TspStopPoint[] = [
		{ ...origin, isOrigin: true },
		...waypoints,
		...(options?.lockedDestination
			? [{ ...options.lockedDestination, isLockedDestination: true }]
			: []),
	];

	// Jika titik hanya 1 atau 2, tidak perlu reordering TSP
	if (allStops.length <= 2) {
		const distKm =
			allStops.length === 2
				? calculateHaversineDistanceKm(
						allStops[0].lat,
						allStops[0].lng,
						allStops[1].lat,
						allStops[1].lng,
					)
				: 0;

		return {
			originalOrder: allStops,
			optimizedOrder: allStops,
			waypointsIndices: allStops.map((_, i) => i),
			totalDistanceMeters: Math.round(distKm * 1000),
			totalDistanceKm: Number((distKm * 1.2).toFixed(2)), // Road factor estimasi
			totalDurationSeconds: Math.round((distKm / 30) * 3600), // Rata-rata 30 km/jam
			totalDurationMinutes: Math.round((distKm / 30) * 60),
			distanceSavedKm: 0,
			estimatedCo2AvoidedKg: Number(
				(distKm * 1.2 * EV_CAR_CO2_SAVED_PER_KM).toFixed(2),
			),
			polyline: allStops.map((s) => [s.lat, s.lng]),
		};
	}

	// Persiapkan koordinat format lng,lat untuk OSRM
	const coordsString = allStops.map((s) => `${s.lng},${s.lat}`).join(";");
	const roundTrip = options?.roundTrip ?? false;
	const hasLockedDest = !!options?.lockedDestination;

	const url = new URL(`/trip/v1/driving/${coordsString}`, OSRM_BASE_URL);
	url.searchParams.set("source", "first");
	if (hasLockedDest) {
		url.searchParams.set("destination", "last");
	} else {
		url.searchParams.set("destination", "any");
	}
	url.searchParams.set("roundtrip", roundTrip ? "true" : "false");
	url.searchParams.set("overview", "full");
	url.searchParams.set("geometries", "geojson");
	url.searchParams.set("steps", "false");

	try {
		const res = await fetch(url.toString(), {
			signal: AbortSignal.timeout(5000), // 5s timeout
		});

		if (!res.ok) {
			throw new Error(`OSRM trip failed: ${res.statusText}`);
		}

		const data: OsrmTripResponse = await res.json();

		if (data.code !== "Ok" || !data.trips || data.trips.length === 0) {
			throw new Error(`OSRM trip returned code: ${data.code}`);
		}

		const primaryTrip = data.trips[0];
		const sortedWaypoints = [...data.waypoints].sort(
			(a, b) => a.waypoint_index - b.waypoint_index,
		);

		// Reorder stops based on OSRM sequence
		const optimizedOrder: TspStopPoint[] = sortedWaypoints.map(
			(wp) => allStops[wp.waypoint_index],
		);
		const waypointsIndices = sortedWaypoints.map((wp) => wp.waypoint_index);

		// Extract polyline [lat, lng]
		const polyline: [number, number][] = primaryTrip.geometry.coordinates.map(
			([lng, lat]) => [lat, lng],
		);

		const totalDistKm = Number((primaryTrip.distance / 1000).toFixed(2));
		const totalDurationMinutes = Math.round(primaryTrip.duration / 60);

		// Hitung jarak sebelum dioptimasi untuk melihat penghematan
		let unoptimizedKm = 0;
		for (let i = 0; i < allStops.length - 1; i++) {
			unoptimizedKm += calculateHaversineDistanceKm(
				allStops[i].lat,
				allStops[i].lng,
				allStops[i + 1].lat,
				allStops[i + 1].lng,
			);
		}
		unoptimizedKm *= 1.25; // estimasi jalan nyata

		const distanceSavedKm = Number(
			Math.max(0, unoptimizedKm - totalDistKm).toFixed(2),
		);
		const co2AvoidedKg = Number(
			(totalDistKm * EV_CAR_CO2_SAVED_PER_KM).toFixed(2),
		);

		return {
			originalOrder: allStops,
			optimizedOrder,
			waypointsIndices,
			totalDistanceMeters: primaryTrip.distance,
			totalDistanceKm: totalDistKm,
			totalDurationSeconds: Math.round(primaryTrip.duration),
			totalDurationMinutes,
			distanceSavedKm,
			estimatedCo2AvoidedKg: co2AvoidedKg,
			polyline,
		};
	} catch (err) {
		console.warn(
			"[OSRM TSP Router] Server error / timeout, falling back to heuristic:",
			err,
		);

		// Heuristic Fallback
		const heuristic = solveTspHeuristic(
			origin,
			waypoints,
			options?.lockedDestination,
		);
		const totalKm = Number((heuristic.totalKm * 1.25).toFixed(2));

		return {
			originalOrder: allStops,
			optimizedOrder: heuristic.optimized,
			waypointsIndices: heuristic.indices,
			totalDistanceMeters: Math.round(totalKm * 1000),
			totalDistanceKm: totalKm,
			totalDurationSeconds: Math.round((totalKm / 35) * 3600),
			totalDurationMinutes: Math.round((totalKm / 35) * 60),
			distanceSavedKm: Number((totalKm * 0.15).toFixed(2)),
			estimatedCo2AvoidedKg: Number(
				(totalKm * EV_CAR_CO2_SAVED_PER_KM).toFixed(2),
			),
			polyline: heuristic.optimized.map((s) => [s.lat, s.lng]),
		};
	}
}
