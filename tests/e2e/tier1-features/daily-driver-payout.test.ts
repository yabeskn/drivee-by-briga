import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getWibDateRange,
  formatBankInfo,
  calculateTripSettlement,
  setMockSettlementData,
  clearMockSettlementData,
  aggregateDailySettlements,
  generateSettlementCsv,
  generateDailyPayoutReport,
  dispatchDailyPayoutReport,
  type DriverMetadataInput,
  type TripSettlementInput,
} from '@/lib/payout/daily-payout-reporter';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/cron/daily-driver-payout/route';

describe('Daily Driver Settlement & Carbon Audit Agent', () => {
  beforeEach(() => {
    clearMockSettlementData();
  });

  afterEach(() => {
    clearMockSettlementData();
  });

  describe('1. Timezone and WIB Date Range Calculation', () => {
    it('should generate accurate WIB boundaries for an explicit date', () => {
      const range = getWibDateRange('2026-10-01');
      expect(range.date).toBe('2026-10-01');
      expect(range.startIso).toBe('2026-10-01T00:00:00+07:00');
      expect(range.endIso).toBe('2026-10-01T23:59:59.999+07:00');
    });

    it('should return a valid YYYY-MM-DD date when date is omitted', () => {
      const range = getWibDateRange();
      expect(range.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.startIso).toContain(range.date);
      expect(range.endIso).toContain(range.date);
    });
  });

  describe('2. Driver Bank Account Information & Fallbacks', () => {
    it('should format complete bank details with account holder name', () => {
      const driver: DriverMetadataInput = {
        id: 'drv-01',
        name: 'Agus Santoso',
        phone: '081234567890',
        bank_name: 'BCA',
        bank_account_number: '8830123456',
        bank_account_holder: 'Agus Santoso',
      };
      expect(formatBankInfo(driver)).toBe('BCA - 8830123456 a.n. Agus Santoso');
    });

    it('should format bank details without account holder name', () => {
      const driver: DriverMetadataInput = {
        id: 'drv-02',
        name: 'Budi Prakoso',
        phone: '085712345678',
        bank_name: 'Bank Mandiri',
        bank_account_number: '1230009876543',
      };
      expect(formatBankInfo(driver)).toBe('Bank Mandiri - 1230009876543');
    });

    it('should fallback gracefully to "Rekening Belum Ada (Hubungi WA)" when bank details are missing', () => {
      const driver: DriverMetadataInput = {
        id: 'drv-03',
        name: 'Citra Dewi',
        phone: '089612345678',
      };
      expect(formatBankInfo(driver)).toBe('Rekening Belum Ada (Hubungi WA)');
    });

    it('should fallback when bank name is present but account number is missing', () => {
      const driver: DriverMetadataInput = {
        id: 'drv-04',
        name: 'Dedi Kurniawan',
        phone: '081398765432',
        bank_name: 'BRI',
        bank_account_number: '',
      };
      expect(formatBankInfo(driver)).toBe('Rekening Belum Ada (Hubungi WA)');
    });
  });

  describe('3. Financial Settlement & Avoided Carbon Calculation', () => {
    it('should accurately calculate gross fare, 85% net payout, and avoided CO2 (0.137 kg/km)', () => {
      const trip: TripSettlementInput = {
        id: 'trip-001',
        driver_id: 'drv-01',
        start_time: '2026-10-01T08:30:00+07:00',
        distance_km: 20, // 20 km
        revenue_distance_km: 20,
      };

      const result = calculateTripSettlement(trip);

      // CO2 avoided: 20 * 0.137 = 2.74 kg
      expect(result.co2AvoidedKg).toBe(2.74);

      // Gross Fare: Rp 15.000 + (20 * 4.500) = Rp 105.000
      expect(result.grossFareIdr).toBe(105000);

      // Platform fee standard: 15% of 105.000 = Rp 15.750
      // Net Payout: 105.000 - 15.750 = Rp 89.250 (85%)
      expect(result.payoutIdr).toBe(89250);
    });

    it('should respect pre-calculated financial_split with platform fee absorption', () => {
      const trip: TripSettlementInput = {
        id: 'trip-002',
        driver_id: 'drv-01',
        start_time: '2026-10-01T14:15:00+07:00',
        distance_km: 15,
        financial_split: {
          grossFareIdr: 80000,
          passengerPaidIdr: 55000,
          brcSubsidyIdr: 25000, // 5 BRC voucher absorbed by platform
          brcCoinsUsed: 5,
          standardPlatformFeeRate: 0.15,
          standardPlatformFeeIdr: 12000,
          platformSubsidyAbsorbedIdr: 12000,
          effectivePlatformFeeIdr: 0,
          driverNetPayoutIdr: 80000, // Fully protected payout
          driverEarningsProtected: true,
          corporateSponsor: 'PT Mitra Lestari',
        },
      };

      const result = calculateTripSettlement(trip);
      expect(result.grossFareIdr).toBe(80000);
      expect(result.payoutIdr).toBe(80000); // Driver receives 100% due to full absorption
      expect(result.co2AvoidedKg).toBe(2.06); // 15 * 0.137 = 2.055 -> 2.06 kg
    });
  });

  describe('4. Daily Aggregation & Multi-Driver Settlement Engine', () => {
    const mockTestDrivers: DriverMetadataInput[] = [
      {
        id: 'drv-budi',
        name: 'Budi Hartono',
        phone: '081211112222',
        bank_name: 'BCA',
        bank_account_number: '5270123456',
        bank_account_holder: 'Budi Hartono',
      },
      {
        id: 'drv-siti',
        name: 'Siti Aminah',
        phone: '085733334444',
        bank_name: 'Bank Mandiri',
        bank_account_number: '1370001234567',
        bank_account_holder: 'Siti Aminah',
      },
      {
        id: 'drv-joko',
        name: 'Joko Widodo',
        phone: '081955556666',
        // No bank account details
      },
    ];

    const mockTestTrips: TripSettlementInput[] = [
      // Budi: 2 trips
      {
        id: 't-1',
        driver_id: 'drv-budi',
        start_time: '2026-10-01T07:15:00+07:00',
        distance_km: 18,
      },
      {
        id: 't-2',
        driver_id: 'drv-budi',
        start_time: '2026-10-01T17:45:00+07:00',
        distance_km: 22,
      },
      // Siti: 1 trip with corporate voucher absorption
      {
        id: 't-3',
        driver_id: 'drv-siti',
        start_time: '2026-10-01T09:00:00+07:00',
        distance_km: 30,
        financial_split: {
          grossFareIdr: 150000,
          passengerPaidIdr: 125000,
          brcSubsidyIdr: 25000,
          brcCoinsUsed: 5,
          standardPlatformFeeRate: 0.15,
          standardPlatformFeeIdr: 22500,
          platformSubsidyAbsorbedIdr: 22500,
          effectivePlatformFeeIdr: 0,
          driverNetPayoutIdr: 150000,
          driverEarningsProtected: true,
        },
      },
      // Joko: 1 trip, no bank info
      {
        id: 't-4',
        driver_id: 'drv-joko',
        start_time: '2026-10-01T11:30:00+07:00',
        distance_km: 10,
      },
      // Outside target date window: should be excluded
      {
        id: 't-5',
        driver_id: 'drv-budi',
        start_time: '2026-10-02T08:00:00+07:00',
        distance_km: 25,
      },
    ];

    it('should aggregate trips correctly and sort drivers by total payout descending', async () => {
      setMockSettlementData(mockTestDrivers, mockTestTrips);

      const aggregated = await aggregateDailySettlements('2026-10-01');

      expect(aggregated.date).toBe('2026-10-01');
      expect(aggregated.drivers.length).toBe(3);
      expect(aggregated.summary.totalDrivers).toBe(3);
      expect(aggregated.summary.totalTrips).toBe(4);

      // Budi should be first because of 178,500 payout (2 trips: 81,600 + 96,900)
      const budi = aggregated.drivers[0];
      expect(budi.driverName).toBe('Budi Hartono');
      expect(budi.tripCount).toBe(2);
      expect(budi.totalPayoutIdr).toBe(178500);

      // Siti should be second with 150,000 payout
      const siti = aggregated.drivers[1];
      expect(siti.driverName).toBe('Siti Aminah');
      expect(siti.driverPhone).toBe('085733334444');
      expect(siti.bankInfo).toBe('Bank Mandiri - 1370001234567 a.n. Siti Aminah');
      expect(siti.tripCount).toBe(1);
      expect(siti.totalPayoutIdr).toBe(150000);
      expect(siti.totalCo2AvoidedKg).toBe(4.11); // 30 * 0.137 = 4.11 kg

      // Joko should have missing bank warning
      const joko = aggregated.drivers.find((d) => d.driverId === 'drv-joko')!;
      expect(joko.bankInfo).toBe('Rekening Belum Ada (Hubungi WA)');
      expect(joko.tripCount).toBe(1);
    });

    it('should generate compliant RFC 4180 CSV with all 6 agreed columns', async () => {
      setMockSettlementData(mockTestDrivers, mockTestTrips);
      const report = await generateDailyPayoutReport('2026-10-01');

      const lines = report.csvContent.split('\r\n');
      expect(lines[0]).toBe(
        'Nama Pengemudi,Nomor HP,Info Rekening Bank,Jumlah Trip,Total Emisi CO2 Dihindari (kg),Total Uang Transfer (Rp)'
      );

      // Contains driver rows
      expect(report.csvContent).toContain('Budi Hartono');
      expect(report.csvContent).toContain('Siti Aminah');
      expect(report.csvContent).toContain('Rekening Belum Ada (Hubungi WA)');

      // Summary row at the bottom
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toContain('TOTAL');
      expect(lastLine).toContain(String(report.summary.totalTrips));
      expect(lastLine).toContain(String(report.summary.totalPayoutIdr));
    });

    it('should generate clean, responsive HTML email with KPI metrics and call-to-action', async () => {
      setMockSettlementData(mockTestDrivers, mockTestTrips);
      const report = await generateDailyPayoutReport('2026-10-01');

      expect(report.htmlEmailContent).toContain('DRIVEE BY BRIGA');
      expect(report.htmlEmailContent).toContain('Rekap Settlement Harian & Audit Karbon');
      expect(report.htmlEmailContent).toContain('2026-10-01');
      expect(report.htmlEmailContent).toContain('23:00 WIB');
      expect(report.htmlEmailContent).toContain('INSTRUKSI OPERASIONAL SETTLEMENT');
      expect(report.htmlEmailContent).toContain('H+1 pukul 12:00 WIB');
      expect(report.htmlEmailContent).toContain('Budi Hartono');
      expect(report.htmlEmailContent).toContain('Rekening Belum Ada (Hubungi WA)');
    });
  });

  describe('5. Resilient Local Fallback Dispatcher', () => {
    it('should save CSV report to disk and return success when no email provider is configured', async () => {
      const testDir = path.resolve(process.cwd(), 'reports', 'test-payout-dir');
      const result = await dispatchDailyPayoutReport({
        date: '2026-10-01',
        recipientEmail: 'test-admin@briga.id',
        outputDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.serviceUsed).toBe('local_fallback');
      expect(result.filePath).toBeDefined();
      expect(fs.existsSync(result.filePath!)).toBe(true);

      // Clean up test file
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('6. Next.js Cron Route Handler (/api/cron/daily-driver-payout)', () => {
    it('should execute GET request and return structured summary JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/daily-driver-payout?date=2026-10-01', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.job).toBe('daily-driver-payout');
      expect(json.date).toBe('2026-10-01');
      expect(json.summary).toBeDefined();
      expect(Array.isArray(json.drivers)).toBe(true);
    });

    it('should execute POST request with body parameters and return structured summary JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/daily-driver-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-10-01', recipient: 'founder@briga.id' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.job).toBe('daily-driver-payout');
      expect(json.recipient).toBe('founder@briga.id');
    });
  });
});
