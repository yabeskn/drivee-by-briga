// ─────────────────────────────────────────────────────────────
// appointments/pricing.ts — Decoy Pricing & Take-Rate Engine
//
// Mengimplementasikan strategi penetapan harga paket sewa terarah
// (The Decoy Effect) yang divalidasi dengan simulasi MiroFish:
// - Paket 2 Jam: Rp 220.000 (Anchor / Pembanding)
// - Paket 4 Jam: Rp 380.000 (The Decoy - dekat ke 8 jam)
// - Paket 8 Jam: Rp 495.000 (Sweet Spot - Best Value, 44% hemat/jam)
// - Paket 12 Jam: Rp 720.000 (Full-day Executive)
//
// Driver Take-Rate: 85% (Melunasi sewa mobil vendor Rp 260k + untung)
// Platform Fee: 15%
// Overtime Rate: Rp 60.000 / jam (85% driver = Rp 51.000 / jam)
// ─────────────────────────────────────────────────────────────

import { BRC_TO_IDR } from "@/lib/brigacoin/balance";
import type { AppointmentPricingTier, DurationHours } from "./types";

export const DRIVER_TAKE_RATE_PCT = 0.85; // 85% komisi pengemudi
export const PLATFORM_FEE_PCT = 0.15; // 15% biaya operasional platform Drifee
export const OVERTIME_HOURLY_RATE_IDR = 60_000; // Rp 60.000 / jam keterlambatan

export const APPOINTMENT_PRICING_TABLE: Record<
	DurationHours,
	AppointmentPricingTier
> = {
	2: {
		hours: 2,
		grossFareIdr: 220_000,
		driverTakeRatePct: DRIVER_TAKE_RATE_PCT,
		driverPayoutIdr: Math.round(220_000 * DRIVER_TAKE_RATE_PCT), // Rp 187.000
		platformFeeIdr: Math.round(220_000 * PLATFORM_FEE_PCT), // Rp 33.000
		includedKm: 30,
		extraKmRateIdr: 4_500,
		hourlyRateIdr: 110_000,
		description:
			"Kunjungan singkat, antar-jemput bandara/stasiun & interview 1 titik",
	},
	4: {
		// THE DECOY: Dibuat sengaja dengan selisih mepet ke 8 jam (Rp 95k/jam vs Rp 61.8k/jam)
		hours: 4,
		grossFareIdr: 380_000,
		driverTakeRatePct: DRIVER_TAKE_RATE_PCT,
		driverPayoutIdr: Math.round(380_000 * DRIVER_TAKE_RATE_PCT), // Rp 323.000
		platformFeeIdr: Math.round(380_000 * PLATFORM_FEE_PCT), // Rp 57.000
		includedKm: 60,
		extraKmRateIdr: 4_000,
		hourlyRateIdr: 95_000,
		description: "Half-day meeting, audit pabrik kilat & 2-3 titik singgah",
	},
	8: {
		// THE SWEET SPOT (BEST VALUE): 99.3% pilihan terbanyak di simulasi
		hours: 8,
		grossFareIdr: 495_000,
		driverTakeRatePct: DRIVER_TAKE_RATE_PCT,
		driverPayoutIdr: Math.round(495_000 * DRIVER_TAKE_RATE_PCT), // Rp 420.750 -> Melunasi sewa vendor Rp 260k
		platformFeeIdr: Math.round(495_000 * PLATFORM_FEE_PCT), // Rp 74.250
		includedKm: 120,
		extraKmRateIdr: 3_500,
		hourlyRateIdr: 61_875,
		isPopularBadge: true,
		savingsVsHourlyPct: 44, // 44% lebih hemat daripada paket 2 jam
		description:
			"Full-day rekrutmen keliling, kunjungan vendor & delegasi direksi (Rekomendasi)",
	},
	12: {
		hours: 12,
		grossFareIdr: 720_000,
		driverTakeRatePct: DRIVER_TAKE_RATE_PCT,
		driverPayoutIdr: Math.round(720_000 * DRIVER_TAKE_RATE_PCT), // Rp 612.000
		platformFeeIdr: Math.round(720_000 * PLATFORM_FEE_PCT), // Rp 108.000
		includedKm: 180,
		extraKmRateIdr: 3_500,
		hourlyRateIdr: 60_000,
		description:
			"Layanan seharian penuh antar kota, multi-pabrik & agenda dinas luar kota",
	},
};

export function getPricingTier(hours: DurationHours): AppointmentPricingTier {
	const tier = APPOINTMENT_PRICING_TABLE[hours];
	if (!tier) {
		return APPOINTMENT_PRICING_TABLE[8]; // Fallback to 8h
	}
	return tier;
}

export interface FareCalculationResult {
	durationHours: DurationHours;
	baseFareIdr: number;
	discountBrc: number;
	discountIdr: number;
	finalPayableIdr: number;
	driverPayoutIdr: number;
	platformFeeIdr: number;
	includedKm: number;
	extraKmRateIdr: number;
}

/**
 * Menghitung rincian tarif pemesanan appointment termasuk subsidi BrigaCoin korporat
 */
export function calculateAppointmentFare(
	hours: DurationHours,
	brigaCoinsToSpend: number = 0,
): FareCalculationResult {
	const tier = getPricingTier(hours);
	const baseFare = tier.grossFareIdr;

	// Potongan diskon BrigaCoin (1 BRC = Rp 5.000)
	const coinEquivalentIdr = Math.max(0, brigaCoinsToSpend) * BRC_TO_IDR;
	const actualDiscountIdr = Math.min(baseFare, coinEquivalentIdr);
	const payableIdr = Math.max(0, baseFare - actualDiscountIdr);

	// Payout driver tetap dihitung dari nilai gross (85% take-rate)
	// Platform menanggung absorpsi diskon dari Corporate ESG Pool
	const driverPayout = tier.driverPayoutIdr;
	const platformFee = tier.platformFeeIdr;

	return {
		durationHours: hours,
		baseFareIdr: baseFare,
		discountBrc: brigaCoinsToSpend,
		discountIdr: actualDiscountIdr,
		finalPayableIdr: payableIdr,
		driverPayoutIdr: driverPayout,
		platformFeeIdr: platformFee,
		includedKm: tier.includedKm,
		extraKmRateIdr: tier.extraKmRateIdr,
	};
}

/**
 * Menghitung denda keterlambatan overtime saat trip selesai
 */
export function calculateOvertimeFare(overtimeHours: number): {
	overtimeHours: number;
	overtimeFareIdr: number;
	driverOvertimePayoutIdr: number;
	platformOvertimeFeeIdr: number;
} {
	const safeHours = Math.max(0, Math.ceil(overtimeHours));
	const totalOvertimeFare = safeHours * OVERTIME_HOURLY_RATE_IDR;
	const driverPayout = Math.round(totalOvertimeFare * DRIVER_TAKE_RATE_PCT);
	const platformFee = totalOvertimeFare - driverPayout;

	return {
		overtimeHours: safeHours,
		overtimeFareIdr: totalOvertimeFare,
		driverOvertimePayoutIdr: driverPayout,
		platformOvertimeFeeIdr: platformFee,
	};
}
