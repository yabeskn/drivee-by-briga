import { RentalOrder, Scope3Emission, CarbonOffset, VehicleCategory } from '@/types/telematics';

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

// ── Rental Order Management ─────────────────────────────────

const rentalStore = new Map<string, RentalOrder>();
const emissionStore = new Map<string, Scope3Emission[]>();
const carbonOffsetStore = new Map<string, CarbonOffset[]>();

export function createRentalOrder(
  companyId: string,
  packageId: string,
  vehicleId: string,
  driverId: string,
  startDate: Date,
  endDate: Date
): { success: boolean; order?: RentalOrder; error?: string } {
  const pkg = rentalPackages.find((p) => p.id === packageId);
  if (!pkg) {
    return { success: false, error: 'Invalid package' };
  }

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
    paymentReference: `INV-${Date.now()}`,
    createdAt: new Date(),
  };

  rentalStore.set(order.id, order);
  return { success: true, order };
}

export function getRentalOrders(companyId: string): RentalOrder[] {
  return Array.from(rentalStore.values()).filter((r) => r.companyId === companyId);
}

export function getRentalOrderById(id: string): RentalOrder | undefined {
  return rentalStore.get(id);
}

export function updatePaymentStatus(
  orderId: string,
  status: RentalOrder['paymentStatus']
): RentalOrder | undefined {
  const order = rentalStore.get(orderId);
  if (!order) return undefined;
  order.paymentStatus = status;
  rentalStore.set(orderId, order);
  return order;
}

// ── Scope 3 Emission Tracking ───────────────────────────────

export function trackEmission(
  companyId: string,
  rentalId: string,
  distanceKm: number,
  category: Scope3Emission['category']
): Scope3Emission {
  const pkg = rentalPackages.find(
    (p) => p.id === rentalStore.get(rentalId)?.packageType
  );
  const emissionFactor = pkg?.emissionFactor || 0.12;

  const emission: Scope3Emission = {
    id: `emi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    companyId,
    rentalId,
    category,
    distanceKm,
    emissionFactor,
    totalEmissionKg: calculateEmission(distanceKm, emissionFactor),
    offsetKg: 0,
    netEmissionKg: calculateEmission(distanceKm, emissionFactor),
    brcEarned: 0,
    createdAt: new Date(),
  };

  const emissions = emissionStore.get(companyId) || [];
  emissions.push(emission);
  emissionStore.set(companyId, emissions);

  return emission;
}

export function getEmissions(companyId: string): Scope3Emission[] {
  return emissionStore.get(companyId) || [];
}

// ── Carbon Offset ───────────────────────────────────────────

export function buyCarbonOffset(
  companyId: string,
  amountKg: number,
  type: CarbonOffset['type']
): { success: boolean; offset?: CarbonOffset; error?: string } {
  // Cost: Rp 50K per ton CO₂
  const cost = (amountKg / 1000) * 50_000;
  // BRC earned: 500 BRC per ton CO₂
  const brcEarned = (amountKg / 1000) * 500;

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

export function getCarbonOffsets(companyId: string): CarbonOffset[] {
  return carbonOffsetStore.get(companyId) || [];
}
