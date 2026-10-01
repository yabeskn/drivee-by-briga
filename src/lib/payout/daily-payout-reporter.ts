// ─────────────────────────────────────────────────────────────
// daily-payout-reporter.ts — Daily Driver Settlement & Carbon Audit Agent
//
// Melakukan agregasi harian perjalanan mobil listrik (EV) per pengemudi,
// menghitung settlement take-rate 85% + subsidi platform fee absorption,
// menghitung emisi CO₂ Scope 3 yang dihindari (0.137 kg/km vs ICE),
// serta men-generate laporan CSV dan HTML email untuk founder/admin.
// ─────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import {
  calculateTripFinancialSplit,
  EV_CAR_CO2_SAVED_PER_KM,
} from '@/lib/corporate/commute';
import type { TripFinancialSplit } from '@/types/telematics';

export interface TripSettlementInput {
  id: string;
  trip_id?: string;
  driver_id: string;
  start_time: string;
  end_time?: string | null;
  distance_km: number;
  revenue_distance_km?: number;
  co2_avoided_kg?: number;
  esg_co2_avoided_kg?: number;
  financial_split?: TripFinancialSplit | null;
  verification_status?: string;
}

export interface DriverMetadataInput {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
}

export interface DailyDriverSettlementRecord {
  driverId: string;
  driverName: string;
  driverPhone: string;
  bankInfo: string;
  tripCount: number;
  totalCo2AvoidedKg: number;
  totalPayoutIdr: number;
  trips: Array<{
    tripId: string;
    distanceKm: number;
    co2AvoidedKg: number;
    grossFareIdr: number;
    payoutIdr: number;
  }>;
}

export interface DailyPayoutSummary {
  totalDrivers: number;
  totalTrips: number;
  totalCo2AvoidedKg: number;
  totalPayoutIdr: number;
  averagePayoutPerDriverIdr: number;
}

export interface DailyPayoutReport {
  date: string; // YYYY-MM-DD (WIB)
  periodStartIso: string;
  periodEndIso: string;
  generatedAtIso: string;
  summary: DailyPayoutSummary;
  drivers: DailyDriverSettlementRecord[];
  csvContent: string;
  htmlEmailContent: string;
}

export interface ReportDispatchResult {
  success: boolean;
  delivered: boolean;
  serviceUsed: 'resend' | 'smtp' | 'local_fallback';
  recipient: string;
  messageId?: string;
  report: DailyPayoutReport;
  filePath?: string;
  error?: string;
}

// In-Memory test fixtures store for deterministic offline/unit testing
let mockDrivers: DriverMetadataInput[] | null = null;
let mockTrips: TripSettlementInput[] | null = null;

export function setMockSettlementData(
  drivers: DriverMetadataInput[] | null,
  trips: TripSettlementInput[] | null
): void {
  mockDrivers = drivers;
  mockTrips = trips;
}

export function clearMockSettlementData(): void {
  mockDrivers = null;
  mockTrips = null;
}

/**
 * Menghitung rentang waktu ISO berdasarkan tanggal WIB (Asia/Jakarta, UTC+7).
 * Default: hari ini dari pukul 00:00:00 hingga 23:59:59 WIB.
 */
export function getWibDateRange(dateStr?: string): {
  date: string;
  startIso: string;
  endIso: string;
} {
  let targetDate = dateStr;
  if (!targetDate) {
    // Ambil tanggal hari ini dalam zona waktu WIB (UTC+7)
    const now = new Date();
    const wibMillis = now.getTime() + 7 * 60 * 60 * 1000;
    const wibDate = new Date(wibMillis);
    targetDate = wibDate.toISOString().slice(0, 10);
  }

  // 00:00:00 WIB = 17:00:00 UTC hari sebelumnya
  const startIso = `${targetDate}T00:00:00+07:00`;
  const endIso = `${targetDate}T23:59:59.999+07:00`;

  return {
    date: targetDate,
    startIso,
    endIso,
  };
}

/**
 * Format string bank account dengan proteksi fallback jika data belum tersedia
 */
export function formatBankInfo(driver: DriverMetadataInput): string {
  const bankName = driver.bank_name?.trim();
  const accNum = driver.bank_account_number?.trim();
  const holder = driver.bank_account_holder?.trim();

  if (bankName && accNum) {
    return `${bankName} - ${accNum}${holder ? ` a.n. ${holder}` : ''}`;
  }
  return 'Rekening Belum Ada (Hubungi WA)';
}

/**
 * Menghitung rincian finansial dan emisi untuk satu trip
 */
export function calculateTripSettlement(trip: TripSettlementInput): {
  distanceKm: number;
  co2AvoidedKg: number;
  grossFareIdr: number;
  payoutIdr: number;
} {
  const distanceKm = Number(trip.distance_km) || 0;
  const revDist = Number(trip.revenue_distance_km) || distanceKm;

  // Emisi CO2 yang dihindari (0.137 kg per km)
  const co2AvoidedKg = Number(
    (
      trip.co2_avoided_kg ??
      trip.esg_co2_avoided_kg ??
      distanceKm * EV_CAR_CO2_SAVED_PER_KM
    ).toFixed(2)
  );

  let grossFareIdr = 0;
  let payoutIdr = 0;

  if (trip.financial_split) {
    grossFareIdr = trip.financial_split.grossFareIdr;
    payoutIdr = trip.financial_split.driverNetPayoutIdr;
  } else {
    // Estimasi tarif dasar Drifee EV: Rp 15.000 + Rp 4.500/km (dibulatkan ke ribuan terdekat)
    grossFareIdr = Math.max(15000, Math.round((15000 + revDist * 4500) / 1000) * 1000);
    // Platform fee absorption (85% net payout)
    const split = calculateTripFinancialSplit({
      grossFareIdr,
      coinsToSpend: 0,
    });
    payoutIdr = split.driverNetPayoutIdr;
  }

  return {
    distanceKm,
    co2AvoidedKg,
    grossFareIdr,
    payoutIdr,
  };
}

/**
 * Mengambil dan mengagregasi data trip harian dari Supabase atau mock store
 */
export async function aggregateDailySettlements(dateStr?: string): Promise<{
  date: string;
  startIso: string;
  endIso: string;
  drivers: DailyDriverSettlementRecord[];
  summary: DailyPayoutSummary;
}> {
  const { date, startIso, endIso } = getWibDateRange(dateStr);

  let trips: TripSettlementInput[] = [];
  let driversList: DriverMetadataInput[] = [];

  if (mockTrips && mockDrivers) {
    // Gunakan in-memory fixture saat testing
    trips = mockTrips.filter((t) => {
      const tripTime = new Date(t.start_time).getTime();
      return (
        tripTime >= new Date(startIso).getTime() &&
        tripTime <= new Date(endIso).getTime()
      );
    });
    driversList = mockDrivers;
  } else if (isAdminConfigured()) {
    try {
      // 1. Ambil trip dalam rentang waktu WIB hari ini
      const { data: tripRows, error: tripErr } = await supabaseAdmin
        .from('trips')
        .select('*')
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .neq('verification_status', 'rejected');

      if (tripErr) {
        console.warn('[DailyPayoutAgent] Supabase trips query failed:', tripErr.message);
      } else if (tripRows) {
        trips = tripRows as unknown as TripSettlementInput[];
      }

      // 2. Ambil master data driver (dengan fallback jika skema bank belum dimigrasi)
      const primaryQuery = await supabaseAdmin
        .from('drivers')
        .select('id, name, phone, email, bank_name, bank_account_number, bank_account_holder');

      let driverRows: unknown[] | null = primaryQuery.data;
      let driverErr = primaryQuery.error;

      if (driverErr && driverErr.message.includes('bank_name')) {
        // Fallback untuk database yang belum di-push migration 007
        const fallbackQuery = await supabaseAdmin
          .from('drivers')
          .select('id, name, phone, email');
        driverRows = fallbackQuery.data;
        driverErr = fallbackQuery.error;
      }

      if (driverErr) {
        console.warn('[DailyPayoutAgent] Supabase drivers query failed:', driverErr.message);
      } else if (driverRows) {
        driversList = driverRows as unknown as DriverMetadataInput[];
      }
    } catch (err) {
      console.warn('[DailyPayoutAgent] Error contacting Supabase:', err);
    }
  }

  // Map drivers by ID
  const driverMap = new Map<string, DriverMetadataInput>();
  for (const d of driversList) {
    driverMap.set(d.id, d);
  }

  // Agregasi trips per driver
  const driverSettlementMap = new Map<string, DailyDriverSettlementRecord>();

  for (const trip of trips) {
    const driverId = trip.driver_id;
    const driver = driverMap.get(driverId) || {
      id: driverId,
      name: `Pengemudi #${driverId.slice(0, 6)}`,
      phone: '-',
    };

    const calc = calculateTripSettlement(trip);

    let record = driverSettlementMap.get(driverId);
    if (!record) {
      record = {
        driverId,
        driverName: driver.name || `Pengemudi #${driverId.slice(0, 6)}`,
        driverPhone: driver.phone || '-',
        bankInfo: formatBankInfo(driver),
        tripCount: 0,
        totalCo2AvoidedKg: 0,
        totalPayoutIdr: 0,
        trips: [],
      };
      driverSettlementMap.set(driverId, record);
    }

    record.tripCount += 1;
    record.totalCo2AvoidedKg = Number(
      (record.totalCo2AvoidedKg + calc.co2AvoidedKg).toFixed(2)
    );
    record.totalPayoutIdr += calc.payoutIdr;
    record.trips.push({
      tripId: trip.trip_id || trip.id,
      distanceKm: calc.distanceKm,
      co2AvoidedKg: calc.co2AvoidedKg,
      grossFareIdr: calc.grossFareIdr,
      payoutIdr: calc.payoutIdr,
    });
  }

  // Urutkan pengemudi berdasarkan total uang transfer terbesar
  const sortedDrivers = Array.from(driverSettlementMap.values()).sort(
    (a, b) => b.totalPayoutIdr - a.totalPayoutIdr
  );

  const totalTrips = sortedDrivers.reduce((sum, d) => sum + d.tripCount, 0);
  const totalCo2 = Number(
    sortedDrivers.reduce((sum, d) => sum + d.totalCo2AvoidedKg, 0).toFixed(2)
  );
  const totalPayout = sortedDrivers.reduce((sum, d) => sum + d.totalPayoutIdr, 0);
  const totalDrivers = sortedDrivers.length;
  const avgPayout = totalDrivers > 0 ? Math.round(totalPayout / totalDrivers) : 0;

  const summary: DailyPayoutSummary = {
    totalDrivers,
    totalTrips,
    totalCo2AvoidedKg: totalCo2,
    totalPayoutIdr: totalPayout,
    averagePayoutPerDriverIdr: avgPayout,
  };

  return {
    date,
    startIso,
    endIso,
    drivers: sortedDrivers,
    summary,
  };
}

/**
 * Format CSV berstandar RFC 4180 dengan 6 kolom yang disepakati
 */
export function generateSettlementCsv(
  drivers: DailyDriverSettlementRecord[],
  summary: DailyPayoutSummary
): string {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headers = [
    'Nama Pengemudi',
    'Nomor HP',
    'Info Rekening Bank',
    'Jumlah Trip',
    'Total Emisi CO2 Dihindari (kg)',
    'Total Uang Transfer (Rp)',
  ];

  const rows: string[] = [headers.map(escapeCsv).join(',')];

  for (const d of drivers) {
    rows.push(
      [
        escapeCsv(d.driverName),
        escapeCsv(d.driverPhone),
        escapeCsv(d.bankInfo),
        d.tripCount,
        d.totalCo2AvoidedKg.toFixed(2),
        d.totalPayoutIdr,
      ].join(',')
    );
  }

  // Baris Total di paling bawah
  rows.push(
    [
      escapeCsv('TOTAL'),
      '',
      '',
      summary.totalTrips,
      summary.totalCo2AvoidedKg.toFixed(2),
      summary.totalPayoutIdr,
    ].join(',')
  );

  return rows.join('\r\n');
}

/**
 * Format mata uang Rupiah
 */
export function formatIdr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/**
 * Generate Template Email HTML Responsif dengan styling elegan & profesional
 */
export function generateSettlementEmailHtml(
  report: Omit<DailyPayoutReport, 'csvContent' | 'htmlEmailContent'>
): string {
  const { date, summary, drivers } = report;

  const tableRowsHtml =
    drivers.length > 0
      ? drivers
          .map((d, index) => {
            const isMissingBank = d.bankInfo.includes('Rekening Belum Ada');
            const bankBadge = isMissingBank
              ? `<span style="background-color: #fef2f2; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #fecaca;">${d.bankInfo}</span>`
              : `<span style="color: #334155; font-weight: 500;">${d.bankInfo}</span>`;

            return `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 14px; font-size: 13px; font-weight: 600; color: #0f172a;">${d.driverName}</td>
              <td style="padding: 12px 14px; font-size: 13px; color: #475569; font-family: monospace;">${d.driverPhone}</td>
              <td style="padding: 12px 14px; font-size: 12px;">${bankBadge}</td>
              <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; text-align: center; font-weight: 600;">${d.tripCount}</td>
              <td style="padding: 12px 14px; font-size: 13px; color: #059669; text-align: right; font-weight: 600;">${d.totalCo2AvoidedKg.toFixed(2)} kg</td>
              <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; text-align: right; font-weight: 700;">${formatIdr(d.totalPayoutIdr)}</td>
            </tr>
          `;
          })
          .join('')
      : `
        <tr>
          <td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
            Tidak ada aktivitas perjalanan EV yang tercatat pada tanggal ini.
          </td>
        </tr>
      `;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rekap Settlement Pengemudi & Audit Karbon - ${date}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 860px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); margin: 0 auto;">
    
    <!-- Header Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 32px 36px; color: #ffffff;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #a7f3d0; margin-bottom: 6px;">
                DRIVEE BY BRIGA • SETTLEMENT AGENT
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.2; color: #ffffff;">
                Rekap Settlement Harian & Audit Karbon
              </h1>
              <div style="font-size: 14px; color: #d1fae5; margin-top: 6px;">
                Periode: <strong>${date}</strong> (Cut-off Harian 23:00 WIB)
              </div>
            </td>
            <td align="right" valign="middle">
              <div style="background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; padding: 8px 16px; text-align: center; display: inline-block;">
                <div style="font-size: 11px; text-transform: uppercase; color: #a7f3d0; font-weight: 600;">Status Audit</div>
                <div style="font-size: 13px; font-weight: 700; color: #ffffff;">TERVERIFIKASI</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- KPI Metric Cards -->
    <tr>
      <td style="padding: 28px 36px 16px 36px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="24%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Total Transfer Payout</div>
              <div style="font-size: 20px; font-weight: 800; color: #047857;">${formatIdr(summary.totalPayoutIdr)}</div>
              <div style="font-size: 11px; color: #059669; margin-top: 2px;">85% Net + 100% Absorbed</div>
            </td>
            <td width="2%"></td>
            <td width="23%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Emisi CO₂ Dihindari</div>
              <div style="font-size: 20px; font-weight: 800; color: #0d9488;">${summary.totalCo2AvoidedKg.toFixed(2)} kg</div>
              <div style="font-size: 11px; color: #0f766e; margin-top: 2px;">Scope 3 GHG Protocol</div>
            </td>
            <td width="2%"></td>
            <td width="23%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Perjalanan EV</div>
              <div style="font-size: 20px; font-weight: 800; color: #1e293b;">${summary.totalTrips} Trip</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Armada Komuter Hijau</div>
            </td>
            <td width="2%"></td>
            <td width="24%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Pengemudi Aktif</div>
              <div style="font-size: 20px; font-weight: 800; color: #1e293b;">${summary.totalDrivers} Orang</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Rata-rata ${formatIdr(summary.averagePayoutPerDriverIdr)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Guidance Callout -->
    <tr>
      <td style="padding: 8px 36px 20px 36px;">
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 6px; padding: 14px 18px;">
          <div style="font-size: 12px; font-weight: 700; color: #065f46; margin-bottom: 2px;">
            INSTRUKSI OPERASIONAL SETTLEMENT
          </div>
          <div style="font-size: 12px; color: #047857; line-height: 1.5;">
            Mohon lakukan transfer bank manual/batch kepada masing-masing pengemudi di bawah sebelum <strong>H+1 pukul 12:00 WIB</strong>. 
            Bagi pengemudi dengan status <em>"Rekening Belum Ada"</em>, mohon hubungi nomor WhatsApp yang tertera untuk konfirmasi rekening sebelum transfer.
          </div>
        </div>
      </td>
    </tr>

    <!-- Main Data Table -->
    <tr>
      <td style="padding: 0 36px 28px 36px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff;">
              <th align="left" style="padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Nama Pengemudi</th>
              <th align="left" style="padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">No. HP / WA</th>
              <th align="left" style="padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Info Rekening Bank</th>
              <th align="center" style="padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Trip</th>
              <th align="right" style="padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Emisi CO₂ (kg)</th>
              <th align="right" style="padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Total Payout (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f1f5f9; border-top: 2px solid #cbd5e1; font-weight: 700;">
              <td style="padding: 14px; font-size: 13px; color: #0f172a;" colspan="3">TOTAL KESELURUHAN</td>
              <td align="center" style="padding: 14px; font-size: 13px; color: #0f172a;">${summary.totalTrips}</td>
              <td align="right" style="padding: 14px; font-size: 13px; color: #059669;">${summary.totalCo2AvoidedKg.toFixed(2)} kg</td>
              <td align="right" style="padding: 14px; font-size: 14px; color: #047857;">${formatIdr(summary.totalPayoutIdr)}</td>
            </tr>
          </tfoot>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 36px; text-align: center;">
        <div style="font-size: 12px; color: #64748b; line-height: 1.6;">
          Laporan ini dibuat otomatis oleh <strong>Daily Driver Settlement & Carbon Audit Agent</strong>.<br>
          File CSV lengkap terlampir pada email ini untuk memudahkan import ke sistem payroll/perbankan.<br>
          © ${new Date().getFullYear()} Drifee by Briga (PT Brigawan Cipta Lestari). All rights reserved.
        </div>
      </td>
    </tr>

  </table>
</body>
</html>
  `.trim();
}

/**
 * Pipeline utama: Membuat laporan harian settlement pengemudi & audit karbon
 */
export async function generateDailyPayoutReport(dateStr?: string): Promise<DailyPayoutReport> {
  const aggregated = await aggregateDailySettlements(dateStr);
  const now = new Date();

  const reportBase = {
    date: aggregated.date,
    periodStartIso: aggregated.startIso,
    periodEndIso: aggregated.endIso,
    generatedAtIso: now.toISOString(),
    summary: aggregated.summary,
    drivers: aggregated.drivers,
  };

  const csvContent = generateSettlementCsv(aggregated.drivers, aggregated.summary);
  const htmlEmailContent = generateSettlementEmailHtml(reportBase);

  return {
    ...reportBase,
    csvContent,
    htmlEmailContent,
  };
}

/**
 * Dispatcher Laporan: Kirim ke Resend / SMTP / Fallback ke file CSV lokal
 */
export async function dispatchDailyPayoutReport(options?: {
  date?: string;
  recipientEmail?: string;
  outputDir?: string;
}): Promise<ReportDispatchResult> {
  const report = await generateDailyPayoutReport(options?.date);
  const recipient =
    options?.recipientEmail ||
    process.env.ADMIN_REPORT_EMAIL ||
    'info@briga.id';

  const resendApiKey = process.env.RESEND_API_KEY;
  const fileName = `daily-payout-${report.date}.csv`;
  const subject = `[Drive-e] Rekap Settlement Pengemudi & Audit Karbon - ${report.date} (23:00 WIB)`;

  // 1. Coba kirim via Resend API jika API Key tersedia
  if (resendApiKey) {
    try {
      const csvBase64 = Buffer.from(report.csvContent, 'utf-8').toString('base64');
      const sender = process.env.SENDER_EMAIL || 'Drive-e Report <report@briga.id>';

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject,
          html: report.htmlEmailContent,
          attachments: [
            {
              filename: fileName,
              content: csvBase64,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          delivered: true,
          serviceUsed: 'resend',
          recipient,
          messageId: data?.id,
          report,
        };
      }

      console.warn('[DailyPayoutAgent] Resend returned non-ok status:', await res.text());
    } catch (err) {
      console.warn('[DailyPayoutAgent] Error sending email via Resend:', err);
    }
  }

  // 2. Fallback aman: Simpan file CSV ke direktori lokal (misal reports/)
  const targetDir = options?.outputDir || path.resolve(process.cwd(), 'reports');
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, fileName);
    fs.writeFileSync(targetPath, report.csvContent, 'utf-8');

    return {
      success: true,
      delivered: false,
      serviceUsed: 'local_fallback',
      recipient,
      filePath: targetPath,
      report,
    };
  } catch (fsErr) {
    return {
      success: true,
      delivered: false,
      serviceUsed: 'local_fallback',
      recipient,
      error: `File save error: ${(fsErr as Error).message}`,
      report,
    };
  }
}
