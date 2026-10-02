// ─────────────────────────────────────────────────────────────
// tests/e2e/tier1-features/multi-trip-corridor.test.ts
// Test Suite: Multi-Trip Operational Corridor & Shift Continuity
// Skenario Spesifik: Cikarang -> CGK -> Deadhead to PIK -> SCBD
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  checkHubGeofence,
  calculateDeadheadKm,
  distanceMetersBetween,
  haversineKm,
  BRIGA_HUBS,
  DECENTRALIZED_SERVICE_CORRIDORS,
} from '@/lib/geofence';
import type { EVVehicle, TripRecord, TripSecurityContext } from '@/types/telematics';
import type { TelematicsState } from '@/hooks/useTelematics';

describe('Tier 1: Multi-Trip Shift Continuity & Inter-Trip Deadhead Corridor', () => {
  // Koordinat simulasi sesuai skenario operasional:
  const CIKARANG_LOC = { latitude: -6.30816, longitude: 107.14987 }; // Hub Cikarang Dry Port
  const CGK_AIRPORT_LOC = { latitude: -6.1256, longitude: 106.6559 }; // Bandara Soekarno-Hatta (CGK)
  const PIK_LOC = { latitude: -6.1086, longitude: 106.7410 };         // Kawasan PIK 1 & 2
  const SCBD_LOC = { latitude: -6.2248, longitude: 106.8090 };        // Kawasan SCBD Sudirman
  const OUT_OF_BOUNDS_LOC = { latitude: -6.9175, longitude: 107.6191 }; // Bandung (di luar jangkauan)

  const mockVehicle: EVVehicle = {
    id: 'ev-wuling-01',
    code: 'EV-01',
    name: 'Wuling BinguoEV Long Range',
    model: 'BinguoEV 2024',
    licensePlate: 'B 1234 BRG',
    batteryCapacityKwh: 31.9,
    currentSoC: 92,
    estimatedRangeKm: 330,
    hubLocation: 'Koridor Layanan Utama Jabodetabek',
    status: 'available',
    efficiencyKwhPer100Km: 11.5,
    category: 'standard',
    seats: 4,
    bluetoothName: 'BINGUO-EV-01',
    rentalPartnerName: 'PT Mitra Mobilindo',
  };

  // ── Skenario Tahap 1: Driver Memulai Trip Pertama di Cikarang ──
  describe('Tahap 1: Start Trip #1 di Cikarang (Tujuan: Bandara CGK)', () => {
    it('1.1: Memvalidasi geofence awal di Cikarang berhasil lolos dalam hub industri', async () => {
      const result = await checkHubGeofence({
        mockCoords: CIKARANG_LOC,
        allowDecentralized: true,
        isSubsequentTrip: false,
      });

      expect(result.allowed).toBe(true);
      expect(result.corridorName).toBe('Hub Cikarang Dry Port');
      expect(result.reason).toContain('Hub Cikarang Dry Port');
      expect(result.deadheadDistanceKm).toBe(0);
    });

    it('1.2: Memvalidasi kalkulasi jarak antar titik awal Cikarang ke CGK (~60-70 km)', () => {
      const distanceKm = haversineKm(
        CIKARANG_LOC.latitude,
        CIKARANG_LOC.longitude,
        CGK_AIRPORT_LOC.latitude,
        CGK_AIRPORT_LOC.longitude,
      );

      expect(distanceKm).toBeGreaterThan(55);
      expect(distanceKm).toBeLessThan(75);
    });
  });

  // ── Skenario Tahap 2: Drop-off di CGK & Menuju PIK (Deadhead) ──
  describe('Tahap 2: Selesai di CGK & Pindah ke PIK (Perhitungan Deadhead)', () => {
    it('2.1: Menghitung jarak pergerakan kosong (deadhead) antara CGK dan PIK secara akurat', () => {
      const deadheadKm = calculateDeadheadKm(
        { lat: CGK_AIRPORT_LOC.latitude, lng: CGK_AIRPORT_LOC.longitude },
        { lat: PIK_LOC.latitude, lng: PIK_LOC.longitude },
      );

      // Jarak garis lurus Bandara CGK ke PIK ~9 - 13 km
      expect(deadheadKm).toBeGreaterThan(8);
      expect(deadheadKm).toBeLessThan(15);
    });

    it('2.2: Mengembalikan deadhead 0 km jika tidak ada riwayat drop-off sebelumnya', () => {
      const deadheadKm = calculateDeadheadKm(null, {
        lat: PIK_LOC.latitude,
        lng: PIK_LOC.longitude,
      });

      expect(deadheadKm).toBe(0);
    });
  });

  // ── Skenario Tahap 3: Start Trip #2 di PIK (Tujuan: SCBD) ──
  describe('Tahap 3: Trip Lanjutan di PIK menuju SCBD (Shift Aktif)', () => {
    it('3.1: Mengizinkan trip lanjutan di PIK tanpa memblokir driver dan mencatat deadhead dari CGK', async () => {
      const result = await checkHubGeofence({
        mockCoords: PIK_LOC,
        allowDecentralized: true,
        isSubsequentTrip: true,
        lastDropoffLocation: {
          lat: CGK_AIRPORT_LOC.latitude,
          lng: CGK_AIRPORT_LOC.longitude,
        },
      });

      expect(result.allowed).toBe(true);
      expect(result.corridorName).toBe('Kawasan Bisnis & Residensial PIK 1 & 2');
      expect(result.reason).toContain('Trip lanjutan');
      expect(result.deadheadDistanceKm).toBeGreaterThan(8);
      expect(result.deadheadDistanceKm).toBeLessThan(15);
    });

    it('3.2: Memvalidasi jarak dari PIK ke SCBD Sudirman (~15-25 km)', () => {
      const distanceKm = haversineKm(
        PIK_LOC.latitude,
        PIK_LOC.longitude,
        SCBD_LOC.latitude,
        SCBD_LOC.longitude,
      );

      expect(distanceKm).toBeGreaterThan(12);
      expect(distanceKm).toBeLessThan(25);
    });
  });

  // ── Skenario Tahap 4: Simulasi State Machine & Atribusi Scope 3 ──
  describe('Tahap 4: Akumulasi Shift, Jarak Efektif & Emisi Scope 3', () => {
    it('4.1: Mensimulasikan siklus lengkap shift multi-trip Cikarang -> CGK -> PIK -> SCBD', () => {
      // Trip 1: Cikarang -> CGK
      const trip1Distance = 64.2;
      const trip1OdoStart = 10000;
      const trip1OdoEnd = trip1OdoStart + trip1Distance;
      const trip1SocStart = 95;
      const trip1SocEnd = Math.max(10, trip1SocStart - Math.round(trip1Distance * 0.35)); // ~73%

      // Shift state setelah Trip 1
      const shiftState = {
        shiftId: 'shift_test_001',
        vehicle: mockVehicle,
        tripsCount: 1,
        lastDropoffLocation: { lat: CGK_AIRPORT_LOC.latitude, lng: CGK_AIRPORT_LOC.longitude },
        lastOdo: trip1OdoEnd,
        lastSoc: trip1SocEnd,
      };

      expect(shiftState.tripsCount).toBe(1);
      expect(shiftState.lastOdo).toBe(10064.2);
      expect(shiftState.lastSoc).toBe(73);

      // Deadhead dari CGK ke PIK sebelum Trip 2
      const interTripDeadhead = calculateDeadheadKm(
        shiftState.lastDropoffLocation,
        { lat: PIK_LOC.latitude, lng: PIK_LOC.longitude },
      );
      expect(interTripDeadhead).toBeGreaterThan(8);

      // Trip 2: PIK -> SCBD
      const trip2Distance = 18.5; // Jarak aktual trip di jalan
      const trip2SecurityDeadhead = 0.8; // Deadhead lokal di PIK menuju penumpang
      const totalDeadheadTrip2 = interTripDeadhead + trip2SecurityDeadhead;
      const revenueDistTrip2 = Math.max(0, trip2Distance - trip2SecurityDeadhead);

      const trip2Record: Partial<TripRecord> = {
        trip_id: 'trip_pik_scbd_002',
        vehicle_id: mockVehicle.id,
        start_odometer_km: shiftState.lastOdo,
        end_odometer_km: shiftState.lastOdo + trip2Distance,
        distance_km: trip2Distance,
        deadhead_distance_km: totalDeadheadTrip2,
        revenue_distance_km: revenueDistTrip2,
      };

      // Verifikasi integritas metrik ESG Scope 3
      expect(trip2Record.start_odometer_km).toBe(10064.2);
      expect(trip2Record.end_odometer_km).toBeCloseTo(10082.7, 1);
      expect(trip2Record.deadhead_distance_km).toBeGreaterThan(9);
      expect(trip2Record.revenue_distance_km).toBe(17.7);

      // Update shift ke trip ke-2
      const updatedShift = {
        ...shiftState,
        tripsCount: shiftState.tripsCount + 1,
        lastDropoffLocation: { lat: SCBD_LOC.latitude, lng: SCBD_LOC.longitude },
        lastOdo: trip2Record.end_odometer_km,
        lastSoc: trip1SocEnd - Math.round(trip2Distance * 0.35),
      };

      expect(updatedShift.tripsCount).toBe(2);
      expect(updatedShift.lastDropoffLocation.lat).toBe(SCBD_LOC.latitude);
      expect(updatedShift.lastDropoffLocation.lng).toBe(SCBD_LOC.longitude);
    });

    it('4.2: Menolak lokasi di luar koridor layanan regional (misal: Bandung)', async () => {
      const result = await checkHubGeofence({
        mockCoords: OUT_OF_BOUNDS_LOC,
        allowDecentralized: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Di luar radius semua wilayah layanan Drifee');
      expect(result.distanceMeters).toBeGreaterThan(50_000);
    });
  });
});
