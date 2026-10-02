// ─────────────────────────────────────────────────────────────
// /api/admin/vehicles — Fleet & Rental Partner Management API
// Handles CRUD operations for decentralized EV vehicles,
// including Bluetooth names, QR tokens, and rental partners.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import type { EVVehicle } from '@/types/telematics';

const DEFAULT_FALLBACK_VEHICLES: EVVehicle[] = [
  {
    id: 'veh_wuling_air_ev',
    code: 'EV-01',
    name: 'Wuling Air EV Long Range',
    model: 'Air EV (26.7 kWh)',
    licensePlate: 'B 1234 EV',
    batteryCapacityKwh: 26.7,
    currentSoC: 88,
    estimatedRangeKm: 264,
    hubLocation: 'Koridor Cikarang - Jababeka',
    status: 'available',
    efficiencyKwhPer100Km: 10.1,
    category: 'standard',
    seats: 4,
    bluetoothName: 'WULING-AIR-01',
    rentalPartnerName: 'Mitra Rental Berkah Cikarang',
    rentalPartnerPhone: '081298765432',
    qrCodeToken: 'QR-BRG-EV01',
    lastOdometerKm: 14250,
  },
  {
    id: 'veh_hyundai_ioniq_5',
    code: 'EV-02',
    name: 'Hyundai Ioniq 5 Signature',
    model: 'Ioniq 5 Long Range (72.6 kWh)',
    licensePlate: 'B 5678 DRI',
    batteryCapacityKwh: 72.6,
    currentSoC: 92,
    estimatedRangeKm: 415,
    hubLocation: 'Koridor Halim - Jakarta Timur',
    status: 'available',
    efficiencyKwhPer100Km: 14.5,
    category: 'professional',
    seats: 5,
    bluetoothName: 'IONIQ-5-DRIFEE',
    rentalPartnerName: 'PT Jababeka Rental Armada',
    rentalPartnerPhone: '081388776655',
    qrCodeToken: 'QR-BRG-EV02',
    lastOdometerKm: 28910,
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q')?.toLowerCase();

    if (isAdminConfigured()) {
      let query = supabaseAdmin
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(
          `code.ilike.%${search}%,name.ilike.%${search}%,license_plate.ilike.%${search}%,bluetooth_name.ilike.%${search}%,rental_partner_name.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const vehicles: EVVehicle[] = data.map((v) => ({
          id: v.id,
          code: v.code,
          name: v.name,
          model: v.model || v.name,
          licensePlate: v.license_plate,
          batteryCapacityKwh: Number(v.battery_capacity_kwh) || 30,
          currentSoC: 90,
          estimatedRangeKm: Math.round(((Number(v.battery_capacity_kwh) || 30) / (Number(v.efficiency_kwh_per_100km) || 12)) * 100),
          hubLocation: v.hub_location || 'Area Bebas Koridor Cikarang',
          status: v.status || 'available',
          efficiencyKwhPer100Km: Number(v.efficiency_kwh_per_100km) || 12,
          category: 'standard',
          seats: 4,
          bluetoothName: v.bluetooth_name || null,
          rentalPartnerName: v.rental_partner_name || null,
          rentalPartnerPhone: v.rental_partner_phone || null,
          qrCodeToken: v.qr_code_token || null,
          lastOdometerKm: Number(v.last_odometer_km) || 0,
        }));
        return NextResponse.json({ success: true, vehicles, source: 'supabase' });
      }
    }

    // Fallback in test/mock environment
    let filtered = DEFAULT_FALLBACK_VEHICLES;
    if (search) {
      filtered = filtered.filter(
        (v) =>
          v.code.toLowerCase().includes(search) ||
          v.name.toLowerCase().includes(search) ||
          v.licensePlate.toLowerCase().includes(search) ||
          (v.bluetoothName && v.bluetoothName.toLowerCase().includes(search)) ||
          (v.rentalPartnerName && v.rentalPartnerName.toLowerCase().includes(search))
      );
    }
    return NextResponse.json({ success: true, vehicles: filtered, source: 'fallback' });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      name,
      model,
      licensePlate,
      batteryCapacityKwh,
      efficiencyKwhPer100Km,
      bluetoothName,
      rentalPartnerName,
      rentalPartnerPhone,
      hubLocation,
      status,
    } = body;

    if (!code || !licensePlate || !name) {
      return NextResponse.json(
        { success: false, error: 'code, name, dan licensePlate wajib diisi' },
        { status: 400 }
      );
    }

    const newVehicleRecord = {
      code,
      name,
      model: model || name,
      license_plate: licensePlate.toUpperCase().trim(),
      battery_capacity_kwh: Number(batteryCapacityKwh) || 30,
      efficiency_kwh_per_100km: Number(efficiencyKwhPer100Km) || 12,
      bluetooth_name: bluetoothName?.trim() || null,
      rental_partner_name: rentalPartnerName?.trim() || null,
      rental_partner_phone: rentalPartnerPhone?.trim() || null,
      qr_code_token: `QR-BRG-${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
      hub_location: hubLocation || 'Koridor Cikarang',
      status: status || 'available',
      updated_at: new Date().toISOString(),
    };

    if (isAdminConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('vehicles')
          .insert(newVehicleRecord)
          .select()
          .single();

        if (!error && data && data.code) {
          return NextResponse.json({ success: true, vehicle: data }, { status: 201 });
        }
      } catch {
        // Fallback to in-memory/mock response
      }
    }

    // Mock fallback response
    return NextResponse.json(
      {
        success: true,
        vehicle: {
          id: `veh_${Date.now()}`,
          ...newVehicleRecord,
        },
        mock: true,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, code, ...updates } = body;

    if (!id && !code) {
      return NextResponse.json(
        { success: false, error: 'id atau code wajib disertakan untuk update' },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.model !== undefined) payload.model = updates.model;
    if (updates.licensePlate !== undefined) payload.license_plate = updates.licensePlate.toUpperCase().trim();
    if (updates.bluetoothName !== undefined) payload.bluetooth_name = updates.bluetoothName?.trim() || null;
    if (updates.rentalPartnerName !== undefined) payload.rental_partner_name = updates.rentalPartnerName?.trim() || null;
    if (updates.rentalPartnerPhone !== undefined) payload.rental_partner_phone = updates.rentalPartnerPhone?.trim() || null;
    if (updates.batteryCapacityKwh !== undefined) payload.battery_capacity_kwh = Number(updates.batteryCapacityKwh);
    if (updates.efficiencyKwhPer100Km !== undefined) payload.efficiency_kwh_per_100km = Number(updates.efficiencyKwhPer100Km);
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.hubLocation !== undefined) payload.hub_location = updates.hubLocation;
    if (updates.lastOdometerKm !== undefined) payload.last_odometer_km = Number(updates.lastOdometerKm);

    if (isAdminConfigured()) {
      try {
        let query = supabaseAdmin.from('vehicles').update(payload);
        if (id) {
          query = query.eq('id', id);
        } else {
          query = query.eq('code', code);
        }
        const { data, error } = await query.select().single();
        if (!error && data && (data.code || data.id)) {
          return NextResponse.json({ success: true, vehicle: data });
        }
      } catch {
        // Fallback to in-memory/mock response
      }
    }

    // Mock fallback response
    return NextResponse.json({
      success: true,
      vehicle: { id: id || `veh_${code}`, code, ...payload },
      mock: true,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
