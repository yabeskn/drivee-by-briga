import Dexie, { type EntityTable } from 'dexie';

// ─────────────────────────────────────────────────────────────
// IndexedDB Schema  –  Dexie.js v4 (class-based)
// Satu database 'briga_telematics' dengan dua tabel:
//   1) telemetry_points  — titik GPS + accel per polling tick
//   2) trip_sessions     — metadata sesi perjalanan
// ─────────────────────────────────────────────────────────────

/** Satu titik telematik yang dikirim ke IndexedDB setiap batch-write */
export interface TelemetryPoint {
  id?: number;              // auto-increment PK
  tripId: string;           // foreign-key ke trip session
  timestamp: number;        // Date.now() epoch ms
  lat: number;
  lng: number;
  accuracy: number;         // GPS accuracy (meters)
  speedMps: number;         // m/s dari Geolocation API (bisa NaN)
  speedKmh: number;         // kalkulasi manual km/h
  heading: number | null;
  altitude: number | null;
  accelX: number;           // DeviceMotion x-axis m/s²
  accelY: number;           // DeviceMotion y-axis m/s²
  accelZ: number;           // DeviceMotion z-axis m/s²
  accelMagnitude: number;   // √(x²+y²+z²) total G-force
  pollingIntervalMs: number; // interval aktif saat titik diambil
  isAccelPaused: boolean;   // true jika accel di-pause (idle >1min)
  drivingStatus: 'smooth' | 'harsh_accel' | 'sudden_brake' | 'idle';
}

/** Metadata sesi trip — satu record per trip */
export interface TripSession {
  id?: number;
  tripId: string;            // UUID unik
  driverId: string;
  vehicleId: string;
  startedAt: number;         // epoch ms
  endedAt?: number;
  totalPoints: number;
  totalDistanceKm: number;
  status: 'active' | 'completed' | 'synced';
}

class BrigaTelematicsDB extends Dexie {
  telemetryPoints!: EntityTable<TelemetryPoint, 'id'>;
  tripSessions!: EntityTable<TripSession, 'id'>;

  constructor() {
    super('briga_telematics');

    this.version(1).stores({
      telemetryPoints: '++id, tripId, timestamp, drivingStatus',
      tripSessions: '++id, tripId, driverId, vehicleId, status',
    });
  }
}

/** Singleton database instance */
export const db = new BrigaTelematicsDB();

// ─────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────

/** Get all telemetry points for a trip, sorted by timestamp */
export async function getTripPoints(tripId: string): Promise<TelemetryPoint[]> {
  return db.telemetryPoints
    .where('tripId')
    .equals(tripId)
    .sortBy('timestamp');
}

/** Count total points stored for a trip */
export async function countTripPoints(tripId: string): Promise<number> {
  return db.telemetryPoints.where('tripId').equals(tripId).count();
}

/** Get a trip session by tripId */
export async function getTripSession(tripId: string): Promise<TripSession | undefined> {
  return db.tripSessions.where('tripId').equals(tripId).first();
}

// ─────────────────────────────────────────────────────────────
// AUTO-PURGE  —  Setelah server membalas VERIFIED
//
// Menghemat RAM & Storage HP setelah trip berjam-jam.
// Dipanggil oleh trip-submitter setelah menerima VERIFIED.
// ─────────────────────────────────────────────────────────────

export interface PurgeResult {
  tripId: string;
  pointsDeleted: number;
  sessionUpdated: boolean;
  purgedAt: number;
}

/**
 * Purge all telemetry points for a verified trip.
 * Keeps the TripSession record (with status='synced') as audit trail.
 */
export async function purgeVerifiedTrip(tripId: string): Promise<PurgeResult> {
  // 1. Count points before delete
  const count = await countTripPoints(tripId);

  // 2. Delete all telemetry points for this trip
  const deleted = await db.telemetryPoints
    .where('tripId')
    .equals(tripId)
    .delete();

  // 3. Update session status to 'synced'
  let sessionUpdated = false;
  const session = await getTripSession(tripId);
  if (session?.id != null) {
    await db.tripSessions.update(session.id, { status: 'synced' });
    sessionUpdated = true;
  }

  return {
    tripId,
    pointsDeleted: deleted,
    sessionUpdated,
    purgedAt: Date.now(),
  };
}

/**
 * Purge ALL completed+synced trips older than maxAgeMs.
 * Safety net for accumulated data from multiple past trips.
 */
export async function purgeOldTrips(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;

  // Find old synced sessions
  const oldSessions = await db.tripSessions
    .where('status')
    .equals('synced')
    .filter((s) => (s.endedAt ?? s.startedAt) < cutoff)
    .toArray();

  let totalDeleted = 0;
  for (const session of oldSessions) {
    const deleted = await db.telemetryPoints
      .where('tripId')
      .equals(session.tripId)
      .delete();
    totalDeleted += deleted;

    // Optionally remove the session record itself
    if (session.id != null) {
      await db.tripSessions.delete(session.id);
    }
  }

  return totalDeleted;
}

/** Get total IndexedDB storage usage estimate (bytes) */
export async function getStorageEstimate(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  usagePercent: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const est = await navigator.storage.estimate();
    const usage = est.usage ?? 0;
    const quota = est.quota ?? 1;
    return {
      usageBytes: usage,
      quotaBytes: quota,
      usagePercent: Math.round((usage / quota) * 10000) / 100,
    };
  }
  return { usageBytes: 0, quotaBytes: 0, usagePercent: 0 };
}
