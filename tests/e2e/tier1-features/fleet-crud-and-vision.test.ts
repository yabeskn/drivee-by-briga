// ─────────────────────────────────────────────────────────────
// tests/e2e/tier1-features/fleet-crud-and-vision.test.ts
// Unit & Integration Test Suite for:
// 1. Admin Vehicles CRUD & Bluetooth Binding API
// 2. Computer Vision Speedometer Parser (Laya / Lightweight Vision)
// 3. Decentralized Hub & Service Corridor Geofence
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getVehicles, POST as createVehicle, PATCH as updateVehicle } from '@/app/api/admin/vehicles/route';
import { POST as parseSpeedometer } from '@/app/api/vision/parse-speedometer/route';
import { checkHubGeofence, distanceMetersBetween, BRIGA_HUBS, DECENTRALIZED_SERVICE_CORRIDORS } from '@/lib/geofence';

describe('Tier 1: Feature Coverage — Fleet CRUD & Speedometer AI Vision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Admin Vehicles CRUD API ──────────────────────────────
  describe('1. Fleet Management & Bluetooth Name CRUD API (/api/admin/vehicles)', () => {
    it('1.1: should return vehicle list with default fallback when called with GET', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/vehicles');
      const res = await getVehicles(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.vehicles)).toBe(true);
      expect(data.vehicles.length).toBeGreaterThan(0);

      // Verify bluetooth_name and rental_partner fields are present
      const first = data.vehicles[0];
      expect(first).toHaveProperty('code');
      expect(first).toHaveProperty('licensePlate');
      expect(first).toHaveProperty('bluetoothName');
    });

    it('1.2: should filter vehicles when search query "q" is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/vehicles?q=wuling');
      const res = await getVehicles(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      const allWuling = data.vehicles.every((v: any) =>
        v.name.toLowerCase().includes('wuling') ||
        v.code.toLowerCase().includes('wuling') ||
        (v.bluetoothName && v.bluetoothName.toLowerCase().includes('wuling'))
      );
      expect(allWuling).toBe(true);
    });

    it('1.3: should reject POST vehicle creation when required fields are missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incomplete EV' }),
      });
      const res = await createVehicle(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('wajib diisi');
    });

    it('1.4: should successfully create a new vehicle with Bluetooth Name and Rental Partner info', async () => {
      const newVehiclePayload = {
        code: 'EV-09',
        name: 'Wuling BinguoEV Long Range',
        model: 'BinguoEV 31.9 kWh',
        licensePlate: 'B 9988 EV',
        batteryCapacityKwh: 31.9,
        bluetoothName: 'BINGUO-EV-09',
        rentalPartnerName: 'Mitra Rental Berkah Mandiri',
        rentalPartnerPhone: '081234567890',
        hubLocation: 'Koridor Cikarang Timur',
        status: 'available',
      };

      const req = new NextRequest('http://localhost:3000/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehiclePayload),
      });

      const res = await createVehicle(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.vehicle.code).toBe('EV-09');
      expect(data.vehicle.bluetooth_name).toBe('BINGUO-EV-09');
      expect(data.vehicle.rental_partner_name).toBe('Mitra Rental Berkah Mandiri');
    });

    it('1.5: should successfully update Bluetooth Name on an existing vehicle with PATCH', async () => {
      const updatePayload = {
        code: 'EV-01',
        bluetoothName: 'RENTAL-BARU-WULING',
        rentalPartnerName: 'CV Rental Surya Cikarang',
      };

      const req = new NextRequest('http://localhost:3000/api/admin/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const res = await updateVehicle(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.vehicle.bluetooth_name).toBe('RENTAL-BARU-WULING');
    });
  });

  // ── 2. Speedometer Vision API ──────────────────────────────
  describe('2. Speedometer AI Vision Parser API (/api/vision/parse-speedometer)', () => {
    it('2.1: should reject empty image payload with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/vision/parse-speedometer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await parseSpeedometer(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('image_base64 wajib disertakan');
    });

    it('2.2: should reject expired timestamp (> 120s) as anti-spoofing protection with HTTP 400', async () => {
      const oldTimestamp = Date.now() - 200_000; // ~3.3 minutes ago
      const req = new NextRequest('http://localhost:3000/api/vision/parse-speedometer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: 'data:image/webp;base64,UklGRmIAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSA...',
          timestamp: oldTimestamp,
        }),
      });

      const res = await parseSpeedometer(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('kedaluwarsa');
    });

    it('2.3: should successfully parse EV cluster image and extract Odometer and SoC with high confidence', async () => {
      const validPayload = {
        image_base64: 'data:image/webp;base64,UklGRmIAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSA_odo_14250_soc_88_synthetic_image_payload',
        vehicle_code: 'EV-01',
        timestamp: Date.now(),
      };

      const req = new NextRequest('http://localhost:3000/api/vision/parse-speedometer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const res = await parseSpeedometer(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.odometer_km).toBe(14250);
      expect(data.battery_soc_percent).toBe(88);
      expect(data.confidence).toBeGreaterThanOrEqual(0.9);
      expect(data.vehicle_model_matched).toBe('Wuling Air EV');
    });

    it('2.4: should reject anomalous negative odometer with HTTP 422', async () => {
      const invalidPayload = {
        image_base64: 'data:image/webp;base64,odo:-50_soc:80_invalid_cluster_sample',
        timestamp: Date.now(),
      };

      const req = new NextRequest('http://localhost:3000/api/vision/parse-speedometer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const res = await parseSpeedometer(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.error).toContain('odometer');
    });

    it('2.5: should reject impossible battery SoC (> 100%) with HTTP 422', async () => {
      const invalidPayload = {
        image_base64: 'data:image/webp;base64,odo:12000_soc:145_impossible_battery_soc',
        timestamp: Date.now(),
      };

      const req = new NextRequest('http://localhost:3000/api/vision/parse-speedometer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const res = await parseSpeedometer(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.error).toContain('baterai');
    });
  });

  // ── 3. Decentralized Pool-Less Geofence Corridor ────────────
  describe('3. Decentralized Fleet & Operational Corridor Geofence', () => {
    it('3.1: should include decentralized service corridor in DECENTRALIZED_SERVICE_CORRIDORS', () => {
      expect(DECENTRALIZED_SERVICE_CORRIDORS.length).toBeGreaterThan(0);
      const corridor = DECENTRALIZED_SERVICE_CORRIDORS[0];
      expect(corridor.name).toContain('Jabodetabek');
      expect(corridor.radiusMeters).toBeGreaterThanOrEqual(50_000); // broad coverage
    });

    it('3.2: should calculate distance correctly using distanceMetersBetween', () => {
      // Distance between Cikarang Dry Port and Halim Airport (~37 km)
      const distMeters = distanceMetersBetween(-6.30816, 107.14987, -6.26652, 106.89033);
      const distKm = distMeters / 1000;
      expect(distKm).toBeGreaterThan(25);
      expect(distKm).toBeLessThan(45);
    });

    it('3.3: should allow driver located anywhere in Jabodetabek/Cikarang under decentralized mode', async () => {
      // Mock navigator.geolocation at a random rental house in Cikarang Barat (-6.275, 107.085)
      const mockPosition = {
        coords: {
          latitude: -6.275,
          longitude: 107.085,
          accuracy: 15,
        },
      };

      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: (success: (pos: any) => void) => success(mockPosition),
        },
      });

      const result = await checkHubGeofence({ allowDecentralized: true });
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('radius');

      vi.unstubAllGlobals();
    });
  });
});
