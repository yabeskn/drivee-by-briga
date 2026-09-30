import { describe, it, expect, beforeEach } from 'vitest';
import {
  allocateCorporateAllowance,
  claimCorporateAllowance,
  calculateCommuteFareDiscount,
  recordCorporateCommuteTrip,
  getCorporateEmissionSummary,
  MIN_COMMUTE_ALLOWANCE_BRC,
  EV_CAR_CO2_SAVED_PER_KM,
} from '@/lib/corporate/commute';
import { _resetMemStore, getBalance } from '@/lib/brigacoin/balance';

describe('Corporate Green Commute & ESG Perks Engine', () => {
  beforeEach(() => {
    _resetMemStore();
  });

  describe('Allocation & Flexible Quota Rules', () => {
    it('should reject allocation below minimum 5 BRC threshold', async () => {
      const res = await allocateCorporateAllowance('demo-corp-cikarang', [
        { email: 'user1@cikarang-mobility.com', amountBrc: 3 }, // < 5 BRC
      ]);

      expect(res.success).toBe(false);
      expect(res.error).toContain('minimal');
      expect(res.allocatedCount).toBe(0);
    });

    it('should accept flexible allocations at or above 5 BRC and generate vouchers if requested', async () => {
      const employees = [
        { email: 'budi@cikarang-mobility.com', amountBrc: 5 }, // Min threshold (Rp 25.000)
        { email: 'siti@cikarang-mobility.com', amountBrc: 10 }, // 10 BRC (Rp 50.000)
        { email: 'hendra@cikarang-mobility.com', amountBrc: 25 }, // Custom intensive (Rp 125.000)
      ];

      const res = await allocateCorporateAllowance('demo-corp-cikarang', employees, {
        generateVouchers: true,
      });

      expect(res.success).toBe(true);
      expect(res.allocatedCount).toBe(3);
      expect(res.totalBrcAllocated).toBe(40);
      expect(res.vouchersGenerated).toBeDefined();
      expect(res.vouchersGenerated?.length).toBe(3);
      expect(res.vouchersGenerated?.[0]).toMatch(/^CORP-/);
    });
  });

  describe('Employee Allowance Claiming', () => {
    it('should allow employee to claim allowance via valid voucher code', async () => {
      // 1. Setup allocation with voucher
      const alloc = await allocateCorporateAllowance(
        'demo-corp-cikarang',
        [{ email: 'employee@perusahaan.com', amountBrc: 10 }],
        { generateVouchers: true }
      );
      const voucher = alloc.vouchersGenerated![0];

      // 2. Claim voucher
      const claim = await claimCorporateAllowance('user_emp_123', 'employee@perusahaan.com', voucher);

      expect(claim.success).toBe(true);
      expect(claim.claimedAmount).toBe(10);
      expect(claim.companyName).toBe('PT Cikarang Green Mobility');

      // 3. Balance verification
      const bal = await getBalance('user_emp_123');
      expect(bal.balance).toBe(10);
      expect(bal.totalEarned).toBe(10);

      // 4. Duplicate claim should fail
      const dupClaim = await claimCorporateAllowance('user_emp_456', 'other@perusahaan.com', voucher);
      expect(dupClaim.success).toBe(false);
    });

    it('should allow employee to claim via email match', async () => {
      await allocateCorporateAllowance('demo-corp-cikarang', [
        { email: 'andi@cikarang-mobility.com', amountBrc: 15 },
      ]);

      const claim = await claimCorporateAllowance('user_andi', 'andi@cikarang-mobility.com');
      expect(claim.success).toBe(true);
      expect(claim.claimedAmount).toBe(15);

      const bal = await getBalance('user_andi');
      expect(bal.balance).toBe(15);
    });
  });

  describe('EV Car Fare Discount Calculation (Closed-Loop Discount)', () => {
    it('should correctly calculate IDR discount and ensure fare cannot be negative', () => {
      // Fare: Rp 45.000, wants to spend 10 BRC (worth Rp 50.000)
      // Balance: 20 BRC
      const result = calculateCommuteFareDiscount(45000, 10, 20, 15);

      expect(result.isValid).toBe(true);
      expect(result.discountIdr).toBe(45000); // Capped at fare, no negative fare
      expect(result.finalFareIdr).toBe(0);
      expect(result.coinsToUse).toBe(9); // 9 BRC * 5000 = 45000
    });

    it('should fail if user tries to spend more coins than balance', () => {
      const result = calculateCommuteFareDiscount(100000, 20, 5, 20); // Has 5, wants to spend 20
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('mencukupi');
    });

    it('should calculate accurate EV car CO2 savings (0.137 kg/km avoided vs ICE)', () => {
      const distanceKm = 20;
      const result = calculateCommuteFareDiscount(60000, 5, 10, distanceKm);

      expect(result.isValid).toBe(true);
      expect(result.estimatedCo2SavedKg).toBeCloseTo(20 * 0.137, 2); // 2.74 kg
    });
  });

  describe('Trip Completion & Scope 3 Reporting', () => {
    it('should deduct coins, record commute trip, and reflect in corporate ESG summary', async () => {
      // 1. Give employee 20 BRC
      const alloc = await allocateCorporateAllowance('demo-corp-cikarang', [
        { email: 'driver_commuter@cikarang-mobility.com', amountBrc: 20 },
      ]);
      await claimCorporateAllowance(
        'emp_driver_99',
        'driver_commuter@cikarang-mobility.com',
        alloc.allowances[0].voucherCode
      );

      // 2. Record 25 km EV trip with 5 BRC discount (Rp 25.000 off Rp 75.000)
      const tripRes = await recordCorporateCommuteTrip({
        userId: 'emp_driver_99',
        userEmail: 'driver_commuter@cikarang-mobility.com',
        tripId: 'trip_ev_cikarang_001',
        distanceKm: 25.0,
        brcSpent: 5,
        fareIdr: 75000,
        corporateId: 'demo-corp-cikarang',
      });

      expect(tripRes.success).toBe(true);
      expect(tripRes.netFareIdr).toBe(50000);
      expect(tripRes.co2SavedKg).toBe(3.43); // 25 * 0.137 = 3.425 -> 3.43

      // 3. User balance should be deducted from 20 to 15
      const bal = await getBalance('emp_driver_99');
      expect(bal.balance).toBe(15);
      expect(bal.totalSpent).toBe(5);

      // 4. Corporate ESG Summary Report
      const summary = await getCorporateEmissionSummary('demo-corp-cikarang');
      expect(summary.corporateId).toBe('demo-corp-cikarang');
      expect(summary.metrics.totalTrips).toBeGreaterThanOrEqual(1);
      expect(summary.metrics.totalDistanceKm).toBeGreaterThanOrEqual(25.0);
      expect(summary.metrics.totalCo2SavedKg).toBeGreaterThanOrEqual(3.43);
      expect(summary.reportingStandard).toContain('POJK 51');
    });
  });
});
