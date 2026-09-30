// ─────────────────────────────────────────────────────────────
// briga.id API Client
// ─────────────────────────────────────────────────────────────

const BRIGA_API_URL = process.env.BRIGA_API_URL || 'https://api.briga.id';
const BRIGA_API_KEY = process.env.BRIGA_API_KEY || '';

interface BrigaApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function brigaFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<BrigaApiResponse<T>> {
  const url = `${BRIGA_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BRIGA_API_KEY}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `briga.id API error: ${response.status}`);
  }

  return response.json();
}

// ── Driver ──────────────────────────────────────────────────

export interface BrigaDriver {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  totalBrigaCoins: number;
  currentStreak: number;
  averageEcoScore: number;
  totalTripsCompleted: number;
}

export async function getBrigaDriver(driverId: string): Promise<BrigaDriver> {
  const response = await brigaFetch<BrigaDriver>(`/drivers/${driverId}`);
  return response.data;
}

export async function syncDriverToBriga(driverData: {
  id: string;
  email: string;
  name: string;
  phone: string;
}): Promise<BrigaDriver> {
  const response = await brigaFetch<BrigaDriver>('/drivers/sync', {
    method: 'POST',
    body: JSON.stringify(driverData),
  });
  return response.data;
}

// ── Trips ───────────────────────────────────────────────────

export interface BrigaTrip {
  id: string;
  driverId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  distanceKm: number;
  ecoScore: number;
  tokensEarned: number;
  status: 'pending' | 'verified' | 'rejected';
}

export async function submitTripToBriga(tripData: {
  tripId: string;
  driverId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  distanceKm: number;
  ecoScore: number;
  tokensEarned: number;
  tripHash: string;
  gpsPoints: Array<{ lat: number; lng: number; timestamp: number }>;
}): Promise<BrigaTrip> {
  const response = await brigaFetch<BrigaTrip>('/trips/submit', {
    method: 'POST',
    body: JSON.stringify(tripData),
  });
  return response.data;
}

// ── BrigaCoins ──────────────────────────────────────────────

export interface BrigaCoinBalance {
  driverId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export async function getBrigaCoinBalance(driverId: string): Promise<BrigaCoinBalance> {
  const response = await brigaFetch<BrigaCoinBalance>(`/coins/balance/${driverId}`);
  return response.data;
}

export async function awardBrigaCoins(driverId: string, amount: number, reason: string): Promise<BrigaCoinBalance> {
  const response = await brigaFetch<BrigaCoinBalance>('/coins/award', {
    method: 'POST',
    body: JSON.stringify({ driverId, amount, reason }),
  });
  return response.data;
}

// ── Leaderboard ─────────────────────────────────────────────

export interface LeaderboardEntry {
  driverId: string;
  driverName: string;
  totalTrips: number;
  averageEcoScore: number;
  totalCoins: number;
  rank: number;
}

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const response = await brigaFetch<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`);
  return response.data;
}
