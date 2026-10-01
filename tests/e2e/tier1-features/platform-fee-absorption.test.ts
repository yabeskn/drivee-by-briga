import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateTripFinancialSplit,
  recordCorporateCommuteTrip,
  DEFAULT_STANDARD_PLATFORM_FEE_RATE,
} from '@/lib/corporate/commute';
import {
  createBoardingPass,
  validateAndBoardPass,
  completeBoardingPass,
  _resetBoardingStore,
} from '@/lib/corporate/boarding';
import { _resetMemStore, addBalance, getBalance, BRC_TO_IDR } from '@/lib/brigacoin/balance';
import { POST as corporateDiscountHandler } from '@/app/api/corporate/discount/route';
import { NextRequest } from 'next/server';

describe('Platform Fee Absorption & Driver Income Protection (Business Model)', () => {
  beforeEach(() => {
    _resetMemStore();
    _resetBoardingStore();
  });

  describe('Mathematical Split Calculation (calculateTripFinancialSplit)', () => {
    it('Scenario 1: Standard Trip without BRC (15% platform fee)', () => {
      const grossFare = 50000;
      const coinsToSpend = 0;

      const split = calculateTripFinancialSplit({
        grossFareIdr: grossFare,
        coinsToSpend,
      });

      expect(split.grossFareIdr).toBe(50000);
      expect(split.passengerPaidIdr).toBe(50000);
      expect(split.brcSubsidyIdr).toBe(0);
      expect(split.brcCoinsUsed).toBe(0);
      expect(split.standardPlatformFeeRate).toBe(0.15);
      expect(split.standardPlatformFeeIdr).toBe(7500); // 15% of 50.000
      expect(split.platformSubsidyAbsorbedIdr).toBe(0);
      expect(split.effectivePlatformFeeIdr).toBe(7500);
      expect(split.driverNetPayoutIdr).toBe(42500); // 85% of 50.000
      expect(split.driverEarningsProtected).toBe(true);
    });

    it('Scenario 2: Partial Fee Absorption (1 BRC = Rp 5.000)', () => {
      const grossFare = 50000;
      const coinsToSpend = 1; // 1 BRC = Rp 5.000

      const split = calculateTripFinancialSplit({
        grossFareIdr: grossFare,
        coinsToSpend,
      });

      expect(split.grossFareIdr).toBe(50000);
      expect(split.brcSubsidyIdr).toBe(5000);
      expect(split.brcCoinsUsed).toBe(1);
      expect(split.passengerPaidIdr).toBe(45000); // 50.000 - 5.000
      expect(split.standardPlatformFeeIdr).toBe(7500);
      // Platform absorbs 5.000 of the 7.500 normal commission
      expect(split.platformSubsidyAbsorbedIdr).toBe(5000);
      expect(split.effectivePlatformFeeIdr).toBe(2500); // 7.500 - 5.000
      // Driver net payout: 50.000 - 2.500 = 47.500 (Driver actually earns Rp 5.000 MORE than standard trip!)
      expect(split.driverNetPayoutIdr).toBe(47500);
      expect(split.driverNetPayoutIdr).toBeGreaterThanOrEqual(50000 * 0.85);
      expect(split.driverEarningsProtected).toBe(true);
    });

    it('Scenario 3: Full Fee Absorption (2 BRC = Rp 10.000 >= Rp 7.500 fee)', () => {
      const grossFare = 50000;
      const coinsToSpend = 2; // 2 BRC = Rp 10.000

      const split = calculateTripFinancialSplit({
        grossFareIdr: grossFare,
        coinsToSpend,
      });

      expect(split.grossFareIdr).toBe(50000);
      expect(split.brcSubsidyIdr).toBe(10000);
      expect(split.brcCoinsUsed).toBe(2);
      expect(split.passengerPaidIdr).toBe(40000); // 50.000 - 10.000
      expect(split.standardPlatformFeeIdr).toBe(7500);
      // Platform absorbs maximum of its standard fee (Rp 7.500)
      expect(split.platformSubsidyAbsorbedIdr).toBe(7500);
      // Effective platform fee drops to Rp 0
      expect(split.effectivePlatformFeeIdr).toBe(0);
      // Driver gets 100% of the gross fare (Rp 50.000)!
      expect(split.driverNetPayoutIdr).toBe(50000);
      expect(split.driverEarningsProtected).toBe(true);
    });

    it('Scenario 4: Fully Subsidized Trip by Corporate (10 BRC = Rp 50.000, 100% Free for Passenger)', () => {
      const grossFare = 50000;
      const coinsToSpend = 10; // 10 BRC = Rp 50.000

      const split = calculateTripFinancialSplit({
        grossFareIdr: grossFare,
        coinsToSpend,
        corporateName: 'PT Cikarang Green Mobility',
      });

      expect(split.grossFareIdr).toBe(50000);
      expect(split.brcSubsidyIdr).toBe(50000);
      expect(split.brcCoinsUsed).toBe(10);
      expect(split.passengerPaidIdr).toBe(0); // Passenger rides for free!
      expect(split.standardPlatformFeeIdr).toBe(7500);
      expect(split.platformSubsidyAbsorbedIdr).toBe(7500);
      expect(split.effectivePlatformFeeIdr).toBe(0);
      // Driver receives full Rp 50.000 funded entirely by corporate BRC pool
      expect(split.driverNetPayoutIdr).toBe(50000);
      expect(split.corporateSponsor).toBe('PT Cikarang Green Mobility');
    });

    it('Scenario 5: Invariant Protection Check across arbitrary fares and coins', () => {
      const testCases = [
        { fare: 15000, coins: 0 },
        { fare: 20000, coins: 1 },
        { fare: 35000, coins: 3 },
        { fare: 65000, coins: 5 },
        { fare: 120000, coins: 10 },
      ];

      for (const tc of testCases) {
        const split = calculateTripFinancialSplit({
          grossFareIdr: tc.fare,
          coinsToSpend: tc.coins,
        });

        // Rule 1: Driver payout must NEVER be less than 85% of gross fare
        const minGuaranteedPayout = Math.round(tc.fare * (1 - DEFAULT_STANDARD_PLATFORM_FEE_RATE));
        expect(split.driverNetPayoutIdr).toBeGreaterThanOrEqual(minGuaranteedPayout);

        // Rule 2: Passenger paid + BRC subsidy must equal gross fare
        expect(split.passengerPaidIdr + split.brcSubsidyIdr).toBe(tc.fare);

        // Rule 3: Effective platform fee must never be negative
        expect(split.effectivePlatformFeeIdr).toBeGreaterThanOrEqual(0);

        // Rule 4: Driver net payout + effective platform fee must equal gross fare
        expect(split.driverNetPayoutIdr + split.effectivePlatformFeeIdr).toBe(tc.fare);
      }
    });

    it('Scenario 6: Boundary & Edge Cases', () => {
      // Zero fare
      const zeroSplit = calculateTripFinancialSplit({ grossFareIdr: 0, coinsToSpend: 5 });
      expect(zeroSplit.grossFareIdr).toBe(0);
      expect(zeroSplit.driverNetPayoutIdr).toBe(0);
      expect(zeroSplit.effectivePlatformFeeIdr).toBe(0);

      // Negative coins treated as 0
      const negativeCoinsSplit = calculateTripFinancialSplit({ grossFareIdr: 50000, coinsToSpend: -3 });
      expect(negativeCoinsSplit.brcCoinsUsed).toBe(0);
      expect(negativeCoinsSplit.driverNetPayoutIdr).toBe(42500);

      // Coins exceeding gross fare are capped to gross fare
      const excessCoinsSplit = calculateTripFinancialSplit({ grossFareIdr: 30000, coinsToSpend: 20 }); // 20 BRC = 100k
      expect(excessCoinsSplit.brcSubsidyIdr).toBe(30000); // Capped to 30.000
      expect(excessCoinsSplit.brcCoinsUsed).toBe(6); // 30.000 / 5.000 = 6 BRC
      expect(excessCoinsSplit.passengerPaidIdr).toBe(0);
      expect(excessCoinsSplit.driverNetPayoutIdr).toBe(30000);
    });
  });

  describe('Commute Lifecycle Integration with Boarding Pass', () => {
    it('should calculate and persist financial split on completeBoardingPass', async () => {
      // 1. Setup passenger with 10 BRC
      await addBalance('user_p_1', 10, 'corporate_allowance', 'Corporate BRC Allowance');

      // 2. Create boarding pass with 4 BRC subsidy on Rp 40.000 fare
      const pass = await createBoardingPass({
        userId: 'user_p_1',
        passengerEmail: 'ani@cikarang-mobility.com',
        passengerName: 'Ani Wijaya',
        discountBrcSelected: 4, // Rp 20.000 subsidy
        estimatedFareIdr: 40000,
        routeCorridor: 'Jababeka II → Meikarta',
      });

      // 3. Driver boards pass
      const boardResult = await validateAndBoardPass(pass.code, 'trip_ev_999', 'driver_dani');
      expect(boardResult.success).toBe(true);

      // 4. Complete trip (15 km)
      const completeResult = await completeBoardingPass('trip_ev_999', 15);
      expect(completeResult.success).toBe(true);
      expect(completeResult.financialSplit).toBeDefined();

      const split = completeResult.financialSplit!;
      expect(split.grossFareIdr).toBe(40000);
      expect(split.brcSubsidyIdr).toBe(20000); // 4 BRC * 5.000
      expect(split.passengerPaidIdr).toBe(20000);
      expect(split.standardPlatformFeeIdr).toBe(6000); // 15% of 40.000
      // 20.000 subsidy > 6.000 standard fee -> fee completely absorbed
      expect(split.platformSubsidyAbsorbedIdr).toBe(6000);
      expect(split.effectivePlatformFeeIdr).toBe(0);
      expect(split.driverNetPayoutIdr).toBe(40000); // 100% payout to driver Dani
      expect(split.driverEarningsProtected).toBe(true);

      // Check passenger balance decreased by 4 BRC
      const newBal = await getBalance('user_p_1');
      expect(newBal.balance).toBe(6); // 10 - 4 = 6 BRC
    });
  });

  describe('API Endpoint Integration (/api/corporate/discount)', () => {
    it('should return financialSplit in response for action=record', async () => {
      await addBalance('user_api_1', 5, 'corporate_allowance', 'Corporate test');

      const req = new NextRequest('http://localhost:3000/api/corporate/discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          userId: 'user_api_1',
          userEmail: 'karyawan@cikarang-mobility.com',
          fareIdr: 50000,
          coinsToSpend: 2,
          distanceKm: 12,
          tripId: 'trip_api_test_1',
          corporateId: 'demo-corp-cikarang',
        }),
      });

      const res = await corporateDiscountHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.financialSplit).toBeDefined();
      expect(json.financialSplit.grossFareIdr).toBe(50000);
      expect(json.financialSplit.driverNetPayoutIdr).toBe(50000);
      expect(json.financialSplit.effectivePlatformFeeIdr).toBe(0);
    });
  });
});
