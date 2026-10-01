import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBoardingPass,
  getActiveBoardingPass,
  validateAndBoardPass,
  completeBoardingPass,
  getPassengerCommuterSummary,
  _resetBoardingStore,
} from '@/lib/corporate/boarding';
import { _resetMemStore, addBalance, getBalance } from '@/lib/brigacoin/balance';
import { POST as boardingPostHandler, GET as boardingGetHandler } from '@/app/api/commuter/boarding/route';
import { POST as boardPostHandler } from '@/app/api/commuter/board/route';
import { NextRequest } from 'next/server';

describe('Commuter & Passenger Boarding Engine (Tier 1)', () => {
  beforeEach(() => {
    _resetMemStore();
    _resetBoardingStore();
  });

  describe('Boarding Pass Generation', () => {
    it('should generate a valid 6-character boarding code and cap discount to available balance', async () => {
      // User has 10 BRC balance
      await addBalance('user_passenger_1', 10, 'corporate_allowance', 'Initial BRC test');

      const pass = await createBoardingPass({
        userId: 'user_passenger_1',
        passengerEmail: 'budi@cikarang-mobility.com',
        passengerName: 'Budi Santoso',
        discountBrcSelected: 15, // Selected more than available (10)
        estimatedFareIdr: 50000,
        routeCorridor: 'Lippo Cikarang → GIIC Deltamas',
      });

      expect(pass.code).toMatch(/^BRG-[0-9A-Z]{3}$/);
      expect(pass.status).toBe('active');
      expect(pass.discountBrcSelected).toBe(10); // Capped to 10 BRC
      expect(pass.subsidyBalanceBrc).toBe(10);
      expect(pass.companyName).toBe('PT Cikarang Green Mobility');
    });

    it('should invalidate older active boarding pass when a new pass is generated', async () => {
      await addBalance('user_passenger_2', 20, 'corporate_allowance', 'Balance');

      const pass1 = await createBoardingPass({
        userId: 'user_passenger_2',
        passengerEmail: 'siti@cikarang-mobility.com',
        passengerName: 'Siti Aminah',
        discountBrcSelected: 5,
      });

      const pass2 = await createBoardingPass({
        userId: 'user_passenger_2',
        passengerEmail: 'siti@cikarang-mobility.com',
        passengerName: 'Siti Aminah',
        discountBrcSelected: 8,
      });

      expect(pass1.code).not.toBe(pass2.code);

      const active = await getActiveBoardingPass('user_passenger_2');
      expect(active?.code).toBe(pass2.code);
      expect(active?.discountBrcSelected).toBe(8);
    });
  });

  describe('Driver Validation & Boarding', () => {
    it('should allow driver to validate boarding pass with case-insensitive code', async () => {
      await addBalance('user_pass_3', 25, 'corporate_allowance', 'Balance');

      const pass = await createBoardingPass({
        userId: 'user_pass_3',
        passengerEmail: 'hendra@cikarang-mobility.com',
        passengerName: 'Hendra Wijaya',
        discountBrcSelected: 5,
        estimatedFareIdr: 40000,
      });

      // Driver enters code in lowercase
      const validation = await validateAndBoardPass(
        pass.code.toLowerCase(),
        'trip_test_101',
        'driver_budi'
      );

      expect(validation.success).toBe(true);
      expect(validation.passengerName).toBe('Hendra Wijaya');
      expect(validation.discountBrc).toBe(5);
      expect(validation.discountIdr).toBe(25000);
      expect(validation.boardingPass?.status).toBe('boarded');
      expect(validation.boardingPass?.tripId).toBe('trip_test_101');
    });

    it('should reject invalid or already completed boarding codes', async () => {
      const invalidValidation = await validateAndBoardPass('BRG-999', 'trip_001', 'driver_001');
      expect(invalidValidation.success).toBe(false);
      expect(invalidValidation.error).toContain('tidak ditemukan');
    });
  });

  describe('Trip Completion & Scope 3 Carbon Accounting', () => {
    it('should complete boarded pass, deduct BRC, and calculate CO2 avoided', async () => {
      await addBalance('user_pass_4', 30, 'corporate_allowance', 'Balance');

      const pass = await createBoardingPass({
        userId: 'user_pass_4',
        passengerEmail: 'ratna@cikarang-mobility.com',
        passengerName: 'Ratna Dewi',
        discountBrcSelected: 6,
        estimatedFareIdr: 50000,
      });

      await validateAndBoardPass(pass.code, 'trip_active_777', 'driver_007');

      // Complete trip with 16.4 km distance
      const result = await completeBoardingPass('trip_active_777', 16.4);

      expect(result.success).toBe(true);
      expect(result.co2SavedKg).toBe(2.25); // 16.4 * 0.137 = 2.2468 -> 2.25 kg
      expect(result.netFareIdr).toBe(20000); // 50000 - (6 * 5000) = 20000

      // Balance should be deducted by 6 BRC (30 - 6 = 24)
      const balanceAfter = await getBalance('user_pass_4');
      expect(balanceAfter.balance).toBe(24);
      expect(balanceAfter.totalSpent).toBe(6);
    });

    it('should produce commuter summary for passenger dashboard', async () => {
      await addBalance('user_pass_summary', 15, 'corporate_allowance', 'Balance');

      const summary = await getPassengerCommuterSummary('user_pass_summary', 'user@cikarang-mobility.com');
      expect(summary.isCorporate).toBe(true);
      expect(summary.companyName).toBe('PT Cikarang Green Mobility');
      expect(summary.balanceBrc).toBe(15);
      expect(summary.balanceIdr).toBe(75000);
      expect(summary.metrics.totalTrips).toBe(0);
    });
  });

  describe('Commuter API Route Handlers', () => {
    it('POST /api/commuter/boarding should create pass', async () => {
      await addBalance('user_api_1', 20, 'corporate_allowance', 'Fund');

      const req = new NextRequest('http://localhost:3000/api/commuter/boarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user_api_1',
          passengerEmail: 'andi@cikarang-mobility.com',
          passengerName: 'Andi Pratama',
          discountBrcSelected: 4,
          estimatedFareIdr: 30000,
        }),
      });

      const res = await boardingPostHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.code).toMatch(/^BRG-/);
      expect(json.data.discountBrcSelected).toBe(4);
    });

    it('POST /api/commuter/board should validate pass for driver', async () => {
      await addBalance('user_api_2', 20, 'corporate_allowance', 'Fund');

      const pass = await createBoardingPass({
        userId: 'user_api_2',
        passengerEmail: 'dewi@cikarang-mobility.com',
        passengerName: 'Dewi Lestari',
        discountBrcSelected: 5,
      });

      const req = new NextRequest('http://localhost:3000/api/commuter/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pass.code,
          tripId: 'trip_api_test',
          driverId: 'driver_001',
        }),
      });

      const res = await boardPostHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.passengerName).toBe('Dewi Lestari');
      expect(json.data.discountBrc).toBe(5);
    });
  });
});
