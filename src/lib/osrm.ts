// ─────────────────────────────────────────────────────────────
// osrm.ts — OSRM Map Matching Client
//
// Mengirim koordinat GPS trip ke OSRM /match endpoint
// untuk snap-to-road dan mengisi gap (blank spot tunnel/BG).
// ─────────────────────────────────────────────────────────────

// Public demo OSRM server — ganti dengan self-hosted untuk prod
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

export interface OsrmCoordinate {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface OsrmMatchedLeg {
  distance: number;   // meters
  duration: number;   // seconds
  steps: unknown[];
}

export interface OsrmMatchedRoute {
  distance: number;   // total meters
  duration: number;   // total seconds
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];  // [lng, lat] pairs
  };
  legs: OsrmMatchedLeg[];
  confidence: number; // 0.0 – 1.0
}

export interface OsrmTracepoint {
  matchings_index: number;
  waypoint_index: number;
  location: [number, number]; // [lng, lat]
  name: string;
}

export interface OsrmMatchResponse {
  code: string;        // "Ok" on success
  matchings: OsrmMatchedRoute[];
  tracepoints: (OsrmTracepoint | null)[];
}

/**
 * Call OSRM /match API to snap GPS trace to road network.
 *
 * @param coordinates Sorted array of GPS points with timestamps
 * @returns OSRM matched response with snapped geometry
 */
export async function matchRouteOSRM(
  coordinates: OsrmCoordinate[],
): Promise<OsrmMatchResponse> {
  if (coordinates.length < 2) {
    throw new Error('OSRM match requires at least 2 coordinates');
  }

  // Build coordinate string: lng,lat;lng,lat;...
  const coordString = coordinates
    .map((c) => `${c.lng},${c.lat}`)
    .join(';');

  // Build timestamps string
  const timestampString = coordinates
    .map((c) => Math.round(c.timestamp / 1000)) // epoch seconds
    .join(';');

  // Build radiuses (GPS accuracy tolerance — 25m default)
  const radiuses = coordinates.map(() => '25').join(';');

  const url = new URL(
    `/match/v1/driving/${coordString}`,
    OSRM_BASE_URL,
  );

  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('timestamps', timestampString);
  url.searchParams.set('radiuses', radiuses);
  url.searchParams.set('gaps', 'split');      // split on big gaps
  url.searchParams.set('tidy', 'true');        // remove duplicates
  url.searchParams.set('annotations', 'true'); // speed/duration

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`OSRM match failed: ${res.status} ${res.statusText}`);
  }

  const data: OsrmMatchResponse = await res.json();
  if (data.code !== 'Ok') {
    throw new Error(`OSRM error: ${data.code}`);
  }

  return data;
}

/**
 * Detect gaps in telemetry timeline > thresholdMs.
 * Returns indices where interpolation is needed.
 */
export function detectGaps(
  coordinates: OsrmCoordinate[],
  thresholdMs: number = 15_000,
): { gapCount: number; gapIndices: number[] } {
  const gapIndices: number[] = [];
  for (let i = 1; i < coordinates.length; i++) {
    const dt = coordinates[i].timestamp - coordinates[i - 1].timestamp;
    if (dt > thresholdMs) {
      gapIndices.push(i);
    }
  }
  return { gapCount: gapIndices.length, gapIndices };
}

/**
 * Extract a flat [lat, lng][] polyline from OSRM matched response.
 */
export function extractMatchedPolyline(
  response: OsrmMatchResponse,
): [number, number][] {
  const points: [number, number][] = [];
  for (const matching of response.matchings) {
    for (const [lng, lat] of matching.geometry.coordinates) {
      points.push([lat, lng]); // convert to [lat, lng] for Leaflet
    }
  }
  return points;
}
