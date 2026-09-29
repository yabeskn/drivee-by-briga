// ─────────────────────────────────────────────────────────────
// osrm.ts — OSRM Map Matching Client
//
// Mengirim koordinat GPS trip ke OSRM /match endpoint
// untuk snap-to-road dan mengisi gap (blank spot tunnel/BG).
//
// FIX B4: Batch processing — OSRM demo server hanya handle 100 titik.
// Trip 2 jam = 7200 titik → di-batch per 100 titik.
// ─────────────────────────────────────────────────────────────

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

// FIX B4: Max points per OSRM request (demo server limit)
const MAX_POINTS_PER_REQUEST = 100;

export interface OsrmCoordinate {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface OsrmMatchedLeg {
  distance: number;
  duration: number;
  steps: unknown[];
}

export interface OsrmMatchedRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs: OsrmMatchedLeg[];
  confidence: number;
}

export interface OsrmTracepoint {
  matchings_index: number;
  waypoint_index: number;
  location: [number, number];
  name: string;
}

export interface OsrmMatchResponse {
  code: string;
  matchings: OsrmMatchedRoute[];
  tracepoints: (OsrmTracepoint | null)[];
}

/**
 * Call OSRM /match API with batching support.
 * Automatically splits large traces into batches of MAX_POINTS_PER_REQUEST.
 */
export async function matchRouteOSRM(
  coordinates: OsrmCoordinate[]
): Promise<OsrmMatchResponse> {
  if (coordinates.length < 2) {
    throw new Error('OSRM match requires at least 2 coordinates');
  }

  // FIX B4: If within limit, send directly
  if (coordinates.length <= MAX_POINTS_PER_REQUEST) {
    return matchRouteOSRMSingle(coordinates);
  }

  // FIX B4: Batch processing for large traces
  return matchRouteOSRMBatched(coordinates);
}

/**
 * Single OSRM request (for small traces)
 */
async function matchRouteOSRMSingle(
  coordinates: OsrmCoordinate[]
): Promise<OsrmMatchResponse> {
  const coordString = coordinates.map((c) => `${c.lng},${c.lat}`).join(';');
  const timestampString = coordinates.map((c) => Math.round(c.timestamp / 1000)).join(';');
  const radiuses = coordinates.map(() => '25').join(';');

  const url = new URL(`/match/v1/driving/${coordString}`, OSRM_BASE_URL);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('timestamps', timestampString);
  url.searchParams.set('radiuses', radiuses);
  url.searchParams.set('gaps', 'split');
  url.searchParams.set('tidy', 'true');
  url.searchParams.set('annotations', 'true');

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
 * Batched OSRM requests (for large traces)
 * Splits coordinates into chunks and processes them in parallel
 */
async function matchRouteOSRMBatched(
  coordinates: OsrmCoordinate[]
): Promise<OsrmMatchResponse> {
  // Split into batches
  const batches: OsrmCoordinate[][] = [];
  for (let i = 0; i < coordinates.length; i += MAX_POINTS_PER_REQUEST) {
    batches.push(coordinates.slice(i, i + MAX_POINTS_PER_REQUEST));
  }

  console.log(`[OSRM] Processing ${coordinates.length} points in ${batches.length} batches`);

  // Process batches in parallel (max 3 concurrent)
  const results: OsrmMatchResponse[] = [];
  const CONCURRENCY = 3;

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map((batch) => matchRouteOSRMSingle(batch)));
    results.push(...chunkResults);
  }

  // Merge results
  return mergeOSRMResults(results);
}

/**
 * Merge multiple OSRM responses into one
 */
function mergeOSRMResults(results: OsrmMatchResponse[]): OsrmMatchResponse {
  const merged: OsrmMatchResponse = {
    code: 'Ok',
    matchings: [],
    tracepoints: [],
  };

  for (const result of results) {
    merged.matchings.push(...result.matchings);
    merged.tracepoints.push(...result.tracepoints);
  }

  return merged;
}

/**
 * Detect gaps in telemetry timeline > thresholdMs.
 */
export function detectGaps(
  coordinates: OsrmCoordinate[],
  thresholdMs: number = 15_000
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
  response: OsrmMatchResponse
): [number, number][] {
  const points: [number, number][] = [];
  for (const matching of response.matchings) {
    for (const [lng, lat] of matching.geometry.coordinates) {
      points.push([lat, lng]);
    }
  }
  return points;
}
