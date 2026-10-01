// ─────────────────────────────────────────────────────────────
// corporate/boarding.ts — Dynamic Boarding Pass & Commuter Lifecycle
//
// Manages commuter boarding passes, linking passenger corporate
// subsidies (BRC) and Scope 3 telemetry with driver EV trips.
// ─────────────────────────────────────────────────────────────

import { getBalance, BRC_TO_IDR } from '@/lib/brigacoin/balance';
import { recordCorporateCommuteTrip, EV_CAR_CO2_SAVED_PER_KM } from './commute';
import type { BoardingPass, BoardingPassValidationResult, TripFinancialSplit } from '@/types/telematics';

// In-memory store for boarding passes (code -> BoardingPass)
const memBoardingPasses = new Map<string, BoardingPass>();

/** Reset store for testing */
export function _resetBoardingStore(): void {
  memBoardingPasses.clear();
}

/** Generate a clean, human-readable 6-character code (e.g. BRG-842) */
function generateCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 3; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BRG-${randomPart}`;
}

export interface CreateBoardingPassInput {
  userId: string;
  passengerEmail: string;
  passengerName: string;
  discountBrcSelected?: number;
  estimatedFareIdr?: number;
  routeCorridor?: string;
  corporateId?: string;
  companyName?: string;
}

/**
 * Buat atau perbarui Boarding Pass aktif untuk penumpang/karyawan
 */
export async function createBoardingPass(
  input: CreateBoardingPassInput
): Promise<BoardingPass> {
  const {
    userId,
    passengerEmail,
    passengerName,
    discountBrcSelected = 0,
    estimatedFareIdr = 45000,
    routeCorridor = 'Lippo Cikarang → GIIC Deltamas',
    corporateId,
    companyName,
  } = input;

  // 1. Ambil saldo koin aktual pengguna
  const userBalance = await getBalance(userId);
  const effectiveBrc = Math.min(Math.max(0, discountBrcSelected), userBalance.balance);

  // 2. Batalkan tiket aktif sebelumnya dari user ini
  for (const [code, pass] of memBoardingPasses.entries()) {
    if (pass.userId === userId && pass.status === 'active') {
      memBoardingPasses.set(code, { ...pass, status: 'expired' });
    }
  }

  // 3. Tentukan nama perusahaan berdasarkan domain jika belum diberikan
  let resolvedCorpId = corporateId;
  let resolvedCompanyName = companyName;

  if (!resolvedCompanyName) {
    const domain = passengerEmail.toLowerCase().split('@')[1];
    if (domain === 'cikarang-mobility.com') {
      resolvedCorpId = 'demo-corp-cikarang';
      resolvedCompanyName = 'PT Cikarang Green Mobility';
    } else if (domain) {
      resolvedCompanyName = `Perusahaan Mitra (@${domain})`;
    }
  }

  // 4. Generate kode unik (pastikan belum dipakai)
  let code = generateCode();
  while (memBoardingPasses.has(code) && memBoardingPasses.get(code)?.status === 'active') {
    code = generateCode();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 45 * 60 * 1000); // 45 menit berlaku

  const boardingPass: BoardingPass = {
    code,
    userId,
    passengerEmail: passengerEmail.toLowerCase().trim(),
    passengerName,
    corporateId: resolvedCorpId,
    companyName: resolvedCompanyName,
    subsidyBalanceBrc: userBalance.balance,
    discountBrcSelected: effectiveBrc,
    estimatedFareIdr,
    routeCorridor,
    status: 'active',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  memBoardingPasses.set(code.toUpperCase(), boardingPass);
  return boardingPass;
}

/**
 * Dapatkan Boarding Pass aktif dari seorang pengguna
 */
export async function getActiveBoardingPass(userId: string): Promise<BoardingPass | null> {
  const now = new Date();
  for (const pass of memBoardingPasses.values()) {
    if (pass.userId === userId && (pass.status === 'active' || pass.status === 'boarded')) {
      const exp = new Date(pass.expiresAt);
      if (exp > now) {
        return pass;
      }
      pass.status = 'expired';
    }
  }
  return null;
}

/**
 * Driver memvalidasi dan men-check in penumpang menggunakan 6-digit Boarding Code
 */
export async function validateAndBoardPass(
  code: string,
  tripId: string,
  driverId: string
): Promise<BoardingPassValidationResult> {
  const normCode = code.toUpperCase().trim();
  const pass = memBoardingPasses.get(normCode);

  if (!pass) {
    return {
      success: false,
      error: `Kode boarding pass "${normCode}" tidak ditemukan`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(pass.expiresAt);

  if (pass.status === 'completed') {
    return {
      success: false,
      error: 'Kode boarding pass ini sudah pernah digunakan dan selesai',
    };
  }

  if (pass.status === 'expired' || expiresAt <= now) {
    pass.status = 'expired';
    return {
      success: false,
      error: 'Kode boarding pass telah kedaluwarsa. Minta penumpang untuk me-refresh dashboard',
    };
  }

  // Update status menjadi boarded dan ikat ke tripId & driverId
  pass.status = 'boarded';
  pass.tripId = tripId;
  pass.driverId = driverId;

  const discountIdr = pass.discountBrcSelected * BRC_TO_IDR;

  return {
    success: true,
    boardingPass: pass,
    passengerName: pass.passengerName,
    companyName: pass.companyName,
    discountBrc: pass.discountBrcSelected,
    discountIdr,
  };
}

/**
 * Selesaikan boarding pass dan potong koin saat trip selesai
 */
export async function completeBoardingPass(
  tripId: string,
  actualDistanceKm: number
): Promise<{ success: boolean; netFareIdr: number; co2SavedKg: number; financialSplit?: TripFinancialSplit }> {
  let matchedPass: BoardingPass | undefined;

  for (const pass of memBoardingPasses.values()) {
    if (pass.tripId === tripId && pass.status === 'boarded') {
      matchedPass = pass;
      break;
    }
  }

  if (!matchedPass) {
    return {
      success: true,
      netFareIdr: 0,
      co2SavedKg: Number((actualDistanceKm * EV_CAR_CO2_SAVED_PER_KM).toFixed(2)),
    };
  }

  matchedPass.status = 'completed';

  // Catat potongan dan log emisi Scope 3
  const commuteResult = await recordCorporateCommuteTrip({
    userId: matchedPass.userId,
    userEmail: matchedPass.passengerEmail,
    tripId,
    distanceKm: actualDistanceKm,
    brcSpent: matchedPass.discountBrcSelected,
    fareIdr: matchedPass.estimatedFareIdr,
    corporateId: matchedPass.corporateId,
  });

  if (commuteResult.financialSplit) {
    matchedPass.financialSplit = commuteResult.financialSplit;
  }

  return {
    success: commuteResult.success,
    netFareIdr: commuteResult.netFareIdr,
    co2SavedKg: commuteResult.co2SavedKg,
    financialSplit: commuteResult.financialSplit,
  };
}

/**
 * Ringkasan statistik emisi dan perjalanan pribadi penumpang
 */
export async function getPassengerCommuterSummary(userId: string, userEmail: string) {
  const normEmail = userEmail.toLowerCase().trim();
  const domain = normEmail.split('@')[1];

  let totalTrips = 0;
  let totalDistanceKm = 0;
  let totalCo2SavedKg = 0;
  let totalBrcUsed = 0;

  for (const pass of memBoardingPasses.values()) {
    if (pass.userId === userId && pass.status === 'completed') {
      totalTrips++;
      const estDistance = 15; // default perkiraan 15 km per trip komuter
      totalDistanceKm += estDistance;
      totalCo2SavedKg += Number((estDistance * EV_CAR_CO2_SAVED_PER_KM).toFixed(2));
      totalBrcUsed += pass.discountBrcSelected;
    }
  }

  const balance = await getBalance(userId);

  return {
    userId,
    email: normEmail,
    isCorporate: domain === 'cikarang-mobility.com' || Boolean(domain && !['gmail.com', 'yahoo.com', 'outlook.com'].includes(domain)),
    companyName: domain === 'cikarang-mobility.com' ? 'PT Cikarang Green Mobility' : (domain ? `Mitra (@${domain})` : 'Umum'),
    balanceBrc: balance.balance,
    balanceIdr: balance.balance * BRC_TO_IDR,
    metrics: {
      totalTrips,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalCo2SavedKg: Number(totalCo2SavedKg.toFixed(2)),
      totalBrcUsed,
      totalSavingsIdr: totalBrcUsed * BRC_TO_IDR,
    },
  };
}
