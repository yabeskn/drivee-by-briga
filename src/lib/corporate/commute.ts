// ─────────────────────────────────────────────────────────────
// corporate/commute.ts — Corporate Green Commute & ESG Perks Engine
//
// Menghubungkan Corporate ESG Pool dengan subsidi perjalanan Mobil EV
// karyawan di Drifee (1 BRC = Rp 5.000).
//
// Regulasi & Standar:
// - POJK No. 51/2017 & GHG Protocol Scope 3 Category 7
// - Closed-loop service discount (UU Mata Uang & UU P2SK No. 4/2023)
// ─────────────────────────────────────────────────────────────

import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import { awardBrigaCoins, spendBalance, BRC_TO_IDR } from '@/lib/brigacoin/balance';
import type { CorporateProfile, CorporateAllowance, CorporateEmissionLog } from '@/types/telematics';

export const MIN_COMMUTE_ALLOWANCE_BRC = 5; // Minimal Rp 25.000 per karyawan
export const EV_CAR_CO2_SAVED_PER_KM = 0.137; // kg CO2 avoided vs ICE car (0.192 - 0.055)

// In-Memory store for tests and fallback
const memCorporateProfiles = new Map<string, CorporateProfile>();
const memCorporateAllowances = new Map<string, CorporateAllowance>();
const memCorporateEmissions = new Map<string, CorporateEmissionLog[]>();

// Initialize default demo corporate profile
memCorporateProfiles.set('demo-corp-cikarang', {
  id: 'demo-corp-cikarang',
  companyName: 'PT Cikarang Green Mobility',
  domain: 'cikarang-mobility.com',
  brigaCoinPool: 2500, // 2,500 BRC = Rp 12.500.000
  minPerEmployee: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export interface AllocateEmployeeInput {
  email: string;
  amountBrc: number;
}

export interface AllocateCorporateResult {
  success: boolean;
  corporateId: string;
  allocatedCount: number;
  totalBrcAllocated: number;
  allowances: CorporateAllowance[];
  vouchersGenerated?: string[];
  error?: string;
}

export interface ClaimResult {
  success: boolean;
  claimedAmount: number;
  companyName: string;
  voucherCode?: string;
  newBalance?: number;
  error?: string;
}

export interface FareDiscountCalculation {
  originalFareIdr: number;
  coinsToUse: number;
  discountIdr: number;
  finalFareIdr: number;
  estimatedCo2SavedKg: number;
  isValid: boolean;
  error?: string;
}

/**
 * Alokasikan kuota komuter hijau kepada daftar karyawan atau buat batch voucher
 */
export async function allocateCorporateAllowance(
  corporateId: string,
  employees: AllocateEmployeeInput[],
  options?: { generateVouchers?: boolean; expiryDays?: number }
): Promise<AllocateCorporateResult> {
  if (!employees || employees.length === 0) {
    return {
      success: false,
      corporateId,
      allocatedCount: 0,
      totalBrcAllocated: 0,
      allowances: [],
      error: 'Daftar karyawan tidak boleh kosong',
    };
  }

  // Validasi batas minimal per karyawan (min 5 BRC)
  for (const emp of employees) {
    if (emp.amountBrc < MIN_COMMUTE_ALLOWANCE_BRC) {
      return {
        success: false,
        corporateId,
        allocatedCount: 0,
        totalBrcAllocated: 0,
        allowances: [],
        error: `Jumlah alokasi minimal adalah ${MIN_COMMUTE_ALLOWANCE_BRC} BRC (Rp ${(MIN_COMMUTE_ALLOWANCE_BRC * BRC_TO_IDR).toLocaleString('id-ID')}) per karyawan`,
      };
    }
  }

  const totalBrc = employees.reduce((sum, e) => sum + e.amountBrc, 0);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (options?.expiryDays || 30));

  const createdAllowances: CorporateAllowance[] = [];
  const vouchers: string[] = [];

  for (const emp of employees) {
    const id = `allow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const voucher = options?.generateVouchers
      ? `CORP-${corporateId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      : undefined;

    if (voucher) vouchers.push(voucher);

    const allowance: CorporateAllowance = {
      id,
      corporateId,
      employeeEmail: emp.email.toLowerCase().trim(),
      amountBrc: emp.amountBrc,
      status: 'allocated',
      voucherCode: voucher,
      expiresAt: expiryDate,
      createdAt: new Date(),
    };

    createdAllowances.push(allowance);
    memCorporateAllowances.set(id, allowance);
  }

  // Update in-memory pool
  const corp = memCorporateProfiles.get(corporateId);
  if (corp) {
    corp.brigaCoinPool = Math.max(0, corp.brigaCoinPool - totalBrc);
    corp.updatedAt = new Date();
  }

  // Optional: write to Supabase if configured
  if (isAdminConfigured()) {
    try {
      const dbRows = createdAllowances.map((a) => ({
        id: a.id.startsWith('allow_') ? undefined : a.id,
        corporate_id: a.corporateId,
        employee_email: a.employeeEmail,
        amount_brc: a.amountBrc,
        status: a.status,
        voucher_code: a.voucherCode,
        expires_at: a.expiresAt?.toISOString(),
      }));

      await supabaseAdmin.from('corporate_allowances').insert(dbRows);
    } catch {
      // Supabase write fallback to in-memory
    }
  }

  return {
    success: true,
    corporateId,
    allocatedCount: createdAllowances.length,
    totalBrcAllocated: totalBrc,
    allowances: createdAllowances,
    vouchersGenerated: vouchers.length > 0 ? vouchers : undefined,
  };
}

/**
 * Klaim kuota BrigaCoin komuter hijau oleh karyawan
 */
export async function claimCorporateAllowance(
  userId: string,
  userEmail: string,
  voucherCode?: string
): Promise<ClaimResult> {
  const emailNorm = userEmail.toLowerCase().trim();
  const voucherNorm = voucherCode?.toUpperCase().trim();

  // 1. Coba via Supabase RPC jika tersedia
  if (isAdminConfigured()) {
    try {
      const { data, error } = await supabaseAdmin.rpc('claim_corporate_allowance', {
        p_user_id: userId,
        p_email: emailNorm,
        p_voucher_code: voucherNorm || null,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        if (row.success) {
          return {
            success: true,
            claimedAmount: row.claimed_amount,
            companyName: row.company_name,
            voucherCode: row.voucher_code,
          };
        }
      }
    } catch {
      // Fallback ke memory check
    }
  }

  // 2. Fallback memory search
  let matchedAllowance: CorporateAllowance | undefined;

  if (voucherNorm) {
    matchedAllowance = Array.from(memCorporateAllowances.values()).find(
      (a) => a.voucherCode?.toUpperCase() === voucherNorm && a.status === 'allocated'
    );
  } else {
    // Cari yang persis email atau domain match
    const domain = emailNorm.split('@')[1];
    matchedAllowance = Array.from(memCorporateAllowances.values()).find((a) => {
      if (a.status !== 'allocated') return false;
      if (a.employeeEmail === emailNorm) return true;
      if (a.employeeEmail === '*' && domain) {
        const corp = memCorporateProfiles.get(a.corporateId);
        return corp?.domain?.toLowerCase() === domain;
      }
      return false;
    });
  }

  if (!matchedAllowance) {
    return {
      success: false,
      claimedAmount: 0,
      companyName: '',
      error: voucherNorm
        ? 'Kode voucher tidak valid, kedaluwarsa, atau sudah digunakan.'
        : 'Tidak ada alokasi kuota komuter pending untuk akun/email Anda.',
    };
  }

  // Tandai sebagai claimed
  matchedAllowance.status = 'claimed';
  matchedAllowance.claimedByUserId = userId;
  matchedAllowance.claimedAt = new Date();

  const corp = memCorporateProfiles.get(matchedAllowance.corporateId);
  const companyName = corp?.companyName || 'Perusahaan Mitra ESG';

  // Kreditkan koin via Server Authoritative Ledger
  const awardResult = await awardBrigaCoins(
    userId,
    matchedAllowance.amountBrc,
    'corporate_allowance',
    `Subsidi Komuter Hijau dari ${companyName}`,
    matchedAllowance.id,
    {
      actor: 'briga',
      idempotencyKey: `claim:${matchedAllowance.id}`,
      userId,
    }
  );

  return {
    success: true,
    claimedAmount: matchedAllowance.amountBrc,
    companyName,
    voucherCode: matchedAllowance.voucherCode,
    newBalance: awardResult.balance.balance,
  };
}

/**
 * Kalkulasi diskon tarif perjalanan Drifee menggunakan BrigaCoin
 * (Khusus Mobil EV Drifee — 100% Closed-Loop Loyalty Discount)
 */
export function calculateCommuteFareDiscount(
  fareIdr: number,
  coinsToSpend: number,
  availableBalance: number,
  distanceKm: number
): FareDiscountCalculation {
  if (fareIdr <= 0) {
    return {
      originalFareIdr: 0,
      coinsToUse: 0,
      discountIdr: 0,
      finalFareIdr: 0,
      estimatedCo2SavedKg: 0,
      isValid: false,
      error: 'Tarif perjalanan tidak valid',
    };
  }

  if (coinsToSpend <= 0) {
    return {
      originalFareIdr: fareIdr,
      coinsToUse: 0,
      discountIdr: 0,
      finalFareIdr: fareIdr,
      estimatedCo2SavedKg: Number((distanceKm * EV_CAR_CO2_SAVED_PER_KM).toFixed(2)),
      isValid: true,
    };
  }

  if (coinsToSpend > availableBalance) {
    return {
      originalFareIdr: fareIdr,
      coinsToUse: 0,
      discountIdr: 0,
      finalFareIdr: fareIdr,
      estimatedCo2SavedKg: 0,
      isValid: false,
      error: 'Saldo BrigaCoin tidak mencukupi',
    };
  }

  const requestedDiscountIdr = coinsToSpend * BRC_TO_IDR;
  // Diskon tidak boleh melebihi tarif asli (tidak ada uang kembalian / negatif)
  const effectiveDiscountIdr = Math.min(requestedDiscountIdr, fareIdr);
  const actualCoinsUsed = Math.ceil(effectiveDiscountIdr / BRC_TO_IDR);
  const finalFareIdr = Math.max(0, fareIdr - effectiveDiscountIdr);
  const estimatedCo2SavedKg = Number((distanceKm * EV_CAR_CO2_SAVED_PER_KM).toFixed(2));

  return {
    originalFareIdr: fareIdr,
    coinsToUse: actualCoinsUsed,
    discountIdr: effectiveDiscountIdr,
    finalFareIdr,
    estimatedCo2SavedKg,
    isValid: true,
  };
}

/**
 * Catat penyelesaian perjalanan komuter hijau dan deduksi koin secara atomik
 */
export async function recordCorporateCommuteTrip(params: {
  userId: string;
  userEmail: string;
  tripId: string;
  distanceKm: number;
  brcSpent: number;
  fareIdr: number;
  corporateId?: string;
}): Promise<{
  success: boolean;
  co2SavedKg: number;
  netFareIdr: number;
  error?: string;
}> {
  const { userId, userEmail, tripId, distanceKm, brcSpent, fareIdr, corporateId } = params;
  const co2SavedKg = Number((distanceKm * EV_CAR_CO2_SAVED_PER_KM).toFixed(2));

  if (brcSpent > 0) {
    const spendRes = await spendBalance(
      userId,
      brcSpent,
      'trip_discount',
      `Potongan Tarif Komuter EV (${distanceKm} km)`,
      tripId,
      {
        actor: 'drifee',
        idempotencyKey: `trip_disc:${tripId}`,
        userId,
      }
    );

    if (!spendRes.success) {
      return {
        success: false,
        co2SavedKg: 0,
        netFareIdr: fareIdr,
        error: spendRes.error || 'Gagal memproses potongan koin',
      };
    }
  }

  // Catat ke log emisi korporat jika terhubung ke profil perusahaan
  const targetCorpId = corporateId || 'demo-corp-cikarang';
  const emissionLog: CorporateEmissionLog = {
    id: `esg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    corporateId: targetCorpId,
    tripId,
    employeeEmail: userEmail,
    distanceKm,
    co2SavedKg,
    brcSpent,
    vehicleType: 'EV_CAR',
    createdAt: new Date(),
  };

  const existingLogs = memCorporateEmissions.get(targetCorpId) || [];
  existingLogs.push(emissionLog);
  memCorporateEmissions.set(targetCorpId, existingLogs);

  // Sync ke Supabase bila configured
  if (isAdminConfigured()) {
    try {
      await supabaseAdmin.from('corporate_emission_logs').insert({
        corporate_id: targetCorpId,
        trip_id: tripId,
        employee_email: userEmail,
        distance_km: distanceKm,
        co2_saved_kg: co2SavedKg,
        brc_spent: brcSpent,
        vehicle_type: 'EV_CAR',
      });
    } catch {
      // Fallback silent
    }
  }

  const netFareIdr = Math.max(0, fareIdr - (brcSpent * BRC_TO_IDR));

  return {
    success: true,
    co2SavedKg,
    netFareIdr,
  };
}

/**
 * Dapatkan rangkuman emisi komuter Scope 3 untuk Laporan Keberlanjutan Korporat (POJK 51)
 */
export async function getCorporateEmissionSummary(corporateId: string) {
  const logs = memCorporateEmissions.get(corporateId) || [];
  const corp = memCorporateProfiles.get(corporateId);

  const totalTrips = logs.length;
  const totalDistanceKm = logs.reduce((sum, l) => sum + l.distanceKm, 0);
  const totalCo2SavedKg = logs.reduce((sum, l) => sum + l.co2SavedKg, 0);
  const totalBrcSpent = logs.reduce((sum, l) => sum + l.brcSpent, 0);
  const uniqueEmployees = new Set(logs.map((l) => l.employeeEmail)).size;

  return {
    corporateId,
    companyName: corp?.companyName || 'Perusahaan Mitra ESG',
    domain: corp?.domain || '',
    metrics: {
      totalTrips,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalCo2SavedKg: Number(totalCo2SavedKg.toFixed(2)),
      totalBrcSpent,
      totalSubsidyValueIdr: totalBrcSpent * BRC_TO_IDR,
      activeEmployees: uniqueEmployees,
      remainingPoolBrc: corp?.brigaCoinPool || 0,
    },
    reportingStandard: 'GHG Protocol Scope 3 Cat 7 / POJK 51/2017',
  };
}
