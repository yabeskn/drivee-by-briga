import { RentalOrder, Scope3Emission, CarbonOffset, VehicleCategory } from '@/types/telematics';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';

function useSupabase(): boolean {
  return isAdminConfigured();
}

// ── Rental Packages ─────────────────────────────────────────

export interface RentalPackage {
  id: string;
  name: string;
  vehicleCategory: VehicleCategory;
  seats: number;
  duration: string;
  price: number;
  distancePerDayKm: number;
  emissionFactor: number;
  description: string;
}

export const rentalPackages: RentalPackage[] = [
  {
    id: 'basic',
    name: 'Basic',
    vehicleCategory: 'standard',
    seats: 4,
    duration: '1 day',
    price: 550_000,
    distancePerDayKm: 100,
    emissionFactor: 0.15,
    description: 'Standard EV with driver for daily rental',
  },
  {
    id: 'family',
    name: 'Family',
    vehicleCategory: 'professional',
    seats: 6,
    duration: '1 day',
    price: 800_000,
    distancePerDayKm: 100,
    emissionFactor: 0.12,
    description: 'Professional EV with driver for family trips',
  },
  {
    id: 'executive',
    name: 'Executive',
    vehicleCategory: 'premium',
    seats: 4,
    duration: '1 day',
    price: 1_350_000,
    distancePerDayKm: 100,
    emissionFactor: 0.10,
    description: 'Premium EV with driver for business travel',
  },
  {
    id: 'executive_plus',
    name: 'Executive+',
    vehicleCategory: 'premium_plus',
    seats: 6,
    duration: '1 day',
    price: 1_800_000,
    distancePerDayKm: 100,
    emissionFactor: 0.10,
    description: 'Premium+ EV with driver for executive travel',
  },
  {
    id: 'weekly',
    name: 'Weekly',
    vehicleCategory: 'professional',
    seats: 6,
    duration: '7 days',
    price: 4_500_000,
    distancePerDayKm: 100,
    emissionFactor: 0.12,
    description: 'Professional EV with driver for weekly rental',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    vehicleCategory: 'premium_plus',
    seats: 6,
    duration: '30 days',
    price: 16_000_000,
    distancePerDayKm: 100,
    emissionFactor: 0.10,
    description: 'Premium+ EV with driver for monthly rental',
  },
];

// ── Emission Calculation ────────────────────────────────────

export function calculateEmission(
  distanceKm: number,
  emissionFactor: number
): number {
  return distanceKm * emissionFactor;
}

export function calculateMonthlyEmission(
  packageId: string
): { totalEmissionKg: number; offsetCost: number; brcEarned: number } {
  const pkg = rentalPackages.find((p) => p.id === packageId);
  if (!pkg) return { totalEmissionKg: 0, offsetCost: 0, brcEarned: 0 };

  const days = pkg.duration === '1 day' ? 1 : pkg.duration === '7 days' ? 7 : 30;
  const totalDistance = pkg.distancePerDayKm * days;
  const totalEmissionKg = calculateEmission(totalDistance, pkg.emissionFactor);

  // Offset cost: Rp 50K per ton CO₂
  const offsetCost = (totalEmissionKg / 1000) * 50_000;

  // BRC earned: 500 BRC per ton CO₂
  const brcEarned = (totalEmissionKg / 1000) * 500;

  return { totalEmissionKg, offsetCost, brcEarned };
}

// ── Fallback In-Memory Stores ────────────────────────────────

const rentalStore = new Map<string, RentalOrder>();
const emissionStore = new Map<string, Scope3Emission[]>();
const carbonOffsetStore = new Map<string, CarbonOffset[]>();

// ── Rental Order Management ─────────────────────────────────

export async function createRentalOrder(
  companyId: string,
  packageId: string,
  vehicleId: string,
  driverId: string,
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; order?: RentalOrder; error?: string }> {
  const pkg = rentalPackages.find((p) => p.id === packageId);
  if (!pkg) {
    return { success: false, error: 'Invalid package' };
  }

  const paymentRef = `INV-${Date.now()}`;

  if (useSupabase()) {
    try {
      const { data, error } = await supabaseAdmin
        .from('hr_rentals')
        .insert({
          company_id: companyId,
          package_type: packageId,
          vehicle_id: vehicleId,
          driver_id: driverId,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          total_price: pkg.price,
          payment_status: 'pending',
          payment_reference: paymentRef,
        })
        .select()
        .single();

      if (error) {
        console.error('[HR Rental] Supabase insert error:', error);
      } else if (data) {
        return {
          success: true,
          order: {
            id: data.id,
            companyId: data.company_id,
            packageType: data.package_type as RentalOrder['packageType'],
            vehicleId: data.vehicle_id,
            driverId: data.driver_id,
            startDate: new Date(data.start_date),
            endDate: new Date(data.end_date),
            totalPrice: data.total_price,
            paymentStatus: data.payment_status as RentalOrder['paymentStatus'],
            paymentMethod: 'transfer',
            paymentReference: data.payment_reference,
            createdAt: new Date(data.created_at),
          },
        };
      }
    } catch (e) {
      console.warn('[HR Rental] Falling back to memory store:', e);
    }
  }

  // Fallback
  const order: RentalOrder = {
    id: `rnt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    companyId,
    packageType: packageId as RentalOrder['packageType'],
    vehicleId,
    driverId,
    startDate,
    endDate,
    totalPrice: pkg.price,
    paymentStatus: 'pending',
    paymentMethod: 'transfer',
    paymentReference: paymentRef,
    createdAt: new Date(),
  };

  rentalStore.set(order.id, order);
  return { success: true, order };
}

export async function getRentalOrders(companyId: string): Promise<RentalOrder[]> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('hr_rentals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      return data.map((d) => ({
        id: d.id,
        companyId: d.company_id,
        packageType: d.package_type as RentalOrder['packageType'],
        vehicleId: d.vehicle_id,
        driverId: d.driver_id,
        startDate: new Date(d.start_date),
        endDate: new Date(d.end_date),
        totalPrice: d.total_price,
        paymentStatus: d.payment_status as RentalOrder['paymentStatus'],
        paymentMethod: 'transfer',
        paymentReference: d.payment_reference,
        createdAt: new Date(d.created_at),
      }));
    }
  }

  return Array.from(rentalStore.values()).filter((r) => r.companyId === companyId);
}

export async function getRentalOrderById(id: string): Promise<RentalOrder | undefined> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('hr_rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      return {
        id: data.id,
        companyId: data.company_id,
        packageType: data.package_type as RentalOrder['packageType'],
        vehicleId: data.vehicle_id,
        driverId: data.driver_id,
        startDate: new Date(data.start_date),
        endDate: new Date(data.end_date),
        totalPrice: data.total_price,
        paymentStatus: data.payment_status as RentalOrder['paymentStatus'],
        paymentMethod: 'transfer',
        paymentReference: data.payment_reference,
        createdAt: new Date(data.created_at),
      };
    }
  }

  return rentalStore.get(id);
}

export async function updatePaymentStatus(
  orderId: string,
  status: RentalOrder['paymentStatus']
): Promise<RentalOrder | undefined> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('hr_rentals')
      .update({ payment_status: status })
      .eq('id', orderId)
      .select()
      .single();

    if (data) {
      return {
        id: data.id,
        companyId: data.company_id,
        packageType: data.package_type as RentalOrder['packageType'],
        vehicleId: data.vehicle_id,
        driverId: data.driver_id,
        startDate: new Date(data.start_date),
        endDate: new Date(data.end_date),
        totalPrice: data.total_price,
        paymentStatus: data.payment_status as RentalOrder['paymentStatus'],
        paymentMethod: 'transfer',
        paymentReference: data.payment_reference,
        createdAt: new Date(data.created_at),
      };
    }
  }

  const order = rentalStore.get(orderId);
  if (!order) return undefined;
  order.paymentStatus = status;
  rentalStore.set(orderId, order);
  return order;
}

// ── Scope 3 Emission Tracking ───────────────────────────────

export async function trackEmission(
  companyId: string,
  rentalId: string,
  distanceKm: number,
  category: Scope3Emission['category']
): Promise<Scope3Emission> {
  const rental = await getRentalOrderById(rentalId);
  const pkg = rentalPackages.find((p) => p.id === rental?.packageType);
  const emissionFactor = pkg?.emissionFactor || 0.12;
  const totalEmissionKg = calculateEmission(distanceKm, emissionFactor);

  if (useSupabase()) {
    try {
      const { data } = await supabaseAdmin
        .from('scope3_emissions')
        .insert({
          company_id: companyId,
          rental_id: rentalId,
          category,
          distance_km: distanceKm,
          emission_factor: emissionFactor,
          total_emission_kg: totalEmissionKg,
        })
        .select()
        .single();

      if (data) {
        return {
          id: data.id,
          companyId: data.company_id,
          rentalId: data.rental_id,
          category: data.category as Scope3Emission['category'],
          distanceKm: data.distance_km,
          emissionFactor: data.emission_factor,
          totalEmissionKg: data.total_emission_kg,
          offsetKg: 0,
          netEmissionKg: data.total_emission_kg,
          brcEarned: 0,
          createdAt: new Date(data.created_at),
        };
      }
    } catch (e) {
      console.warn('[HR Emission] Supabase insert failed, using fallback:', e);
    }
  }

  const emission: Scope3Emission = {
    id: `emi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    companyId,
    rentalId,
    category,
    distanceKm,
    emissionFactor,
    totalEmissionKg,
    offsetKg: 0,
    netEmissionKg: totalEmissionKg,
    brcEarned: 0,
    createdAt: new Date(),
  };

  const emissions = emissionStore.get(companyId) || [];
  emissions.push(emission);
  emissionStore.set(companyId, emissions);

  return emission;
}

export async function getEmissions(companyId: string): Promise<Scope3Emission[]> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('scope3_emissions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      return data.map((d) => ({
        id: d.id,
        companyId: d.company_id,
        rentalId: d.rental_id,
        category: d.category as Scope3Emission['category'],
        distanceKm: d.distance_km,
        emissionFactor: d.emission_factor,
        totalEmissionKg: d.total_emission_kg,
        offsetKg: 0,
        netEmissionKg: d.total_emission_kg,
        brcEarned: 0,
        createdAt: new Date(d.created_at),
      }));
    }
  }

  return emissionStore.get(companyId) || [];
}

// ── Carbon Offset ───────────────────────────────────────────

export async function buyCarbonOffset(
  companyId: string,
  amountKg: number,
  type: CarbonOffset['type']
): Promise<{ success: boolean; offset?: CarbonOffset; error?: string }> {
  // Cost: Rp 50K per ton CO₂
  const cost = (amountKg / 1000) * 50_000;
  // BRC earned: 500 BRC per ton CO₂
  const brcEarned = (amountKg / 1000) * 500;

  if (useSupabase()) {
    try {
      const { data } = await supabaseAdmin
        .from('carbon_offsets')
        .insert({
          company_id: companyId,
          amount_kg: amountKg,
          type,
          cost,
          brc_earned: brcEarned,
          certificate_url: null,
        })
        .select()
        .single();

      if (data) {
        return {
          success: true,
          offset: {
            id: data.id,
            companyId: data.company_id,
            amountKg: data.amount_kg,
            type: data.type as CarbonOffset['type'],
            cost: data.cost,
            brcEarned: data.brc_earned,
            createdAt: new Date(data.created_at),
          },
        };
      }
    } catch (e) {
      console.warn('[Carbon Offset] Supabase insert failed, using fallback:', e);
    }
  }

  const offset: CarbonOffset = {
    id: `ofs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    companyId,
    amountKg,
    type,
    cost,
    brcEarned,
    createdAt: new Date(),
  };

  const offsets = carbonOffsetStore.get(companyId) || [];
  offsets.push(offset);
  carbonOffsetStore.set(companyId, offsets);

  return { success: true, offset };
}

export async function getCarbonOffsets(companyId: string): Promise<CarbonOffset[]> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('carbon_offsets')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      return data.map((d) => ({
        id: d.id,
        companyId: d.company_id,
        amountKg: d.amount_kg,
        type: d.type as CarbonOffset['type'],
        cost: d.cost,
        brcEarned: d.brc_earned,
        createdAt: new Date(d.created_at),
      }));
    }
  }

  return carbonOffsetStore.get(companyId) || [];
}
