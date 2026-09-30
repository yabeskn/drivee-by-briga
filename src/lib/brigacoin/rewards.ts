// ─────────────────────────────────────────────────────────────
// brigacoin/rewards.ts — Rewards Catalog from Supabase
//
// WS3: Migrated from hardcoded array to Supabase `rewards` table.
// Falls back to in-memory catalog when Supabase not configured.
// ─────────────────────────────────────────────────────────────

import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import type { Reward, VehicleCategory, UserType } from '@/types/telematics';

// ── Fallback catalog (Fase 1: Closed-Loop Diskon Armada Mobil Listrik EV Drifee) ────
const fallbackCatalog: Reward[] = [
  { id: 'ev_001', name: 'Diskon Komuter EV Rp 25.000', description: 'Potongan langsung tarif armada Mobil Listrik Drifee (100% closed-loop)', category: 'transport', cost: 5, stock: 9999, image: '', terms: 'Berlaku untuk semua perjalanan armada Mobil Listrik Drifee', type: 'discount', userType: 'all', status: 'active' },
  { id: 'ev_002', name: 'Diskon Komuter EV Rp 50.000', description: 'Potongan langsung tarif armada Mobil Listrik Drifee (100% closed-loop)', category: 'transport', cost: 10, stock: 9999, image: '', terms: 'Berlaku untuk semua perjalanan armada Mobil Listrik Drifee', type: 'discount', userType: 'all', status: 'active' },
  { id: 'ev_003', name: 'Diskon Shuttle Bandara EV Rp 100.000', description: 'Potongan shuttle eksekutif Cikarang - Bandara Soekarno Hatta', category: 'transport', cost: 20, stock: 9999, image: '', terms: 'Armada Hyundai Ioniq 5 / BYD Atto 3', type: 'discount', userType: 'all', status: 'active' },
  { id: 'carbon_001', name: 'Sertifikat Carbon Offset 10 kg CO₂', description: 'Kompensasi emisi komuter terverifikasi standar POJK No. 51/2017', category: 'carbon', cost: 5, stock: 9999, image: '', terms: 'Sertifikat resmi reduksi emisi Scope 3 Kategori 7', type: 'voucher', userType: 'all', status: 'active' },
  { id: 'int_001', name: 'Prioritas Penjemputan EV Priority', description: 'Prioritas penugasan armada mobil listrik terdekat', category: 'internal', cost: 15, stock: 999, image: '', terms: 'Masa aktif fitur 30 hari', type: 'feature', userType: 'all', status: 'active' },
  // Legacy / partner test compatibility fixtures
  { id: 'ext_001', name: 'Voucher GoFood Rp 25K', description: 'GoFood voucher Rp 25,000', category: 'voucher', cost: 50, stock: 500, image: '', terms: 'Valid 30 days', type: 'voucher', userType: 'all', status: 'active' },
  { id: 'ext_003', name: 'Top-up GoPay Rp 50K', description: 'GoPay top-up Rp 50,000', category: 'ewallet', cost: 100, stock: 500, image: '', terms: 'Auto-credit', type: 'auto_credit', userType: 'all', status: 'active' },
  { id: 'ext_004', name: 'Top-up e-toll Rp 100K', description: 'e-toll top-up Rp 100,000', category: 'transport', cost: 200, stock: 500, image: '', terms: 'Auto-credit', type: 'auto_credit', userType: 'all', status: 'active' },
];

function useSupabase(): boolean {
  return isAdminConfigured();
}

// ── Map DB row to Reward type ───────────────────────────────
function rowToReward(row: Record<string, unknown>): Reward {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    category: (row.category as Reward['category']) ?? 'internal',
    cost: row.cost as number,
    stock: (row.stock as number) ?? 0,
    image: (row.image_url as string) ?? '',
    terms: (row.terms as string) ?? '',
    type: (row.reward_type as Reward['type']) ?? 'voucher',
    userType: (row.user_type as UserType) ?? 'all',
    status: (row.status as Reward['status']) ?? 'active',
    partnerId: (row.partner_id as string) ?? undefined,
    vehicleCategory: (row.vehicle_category as VehicleCategory | 'all') ?? undefined,
  };
}

// ── Get Rewards ─────────────────────────────────────────────

export async function getRewards(
  userType?: UserType,
  vehicleCategory?: VehicleCategory,
): Promise<Reward[]> {
  if (useSupabase()) {
    let query = supabaseAdmin
      .from('rewards')
      .select('*')
      .eq('status', 'active');

    if (userType) {
      query = query.or(`user_type.eq.all,user_type.eq.${userType}`);
    }

    const { data } = await query;
    let rewards = (data ?? []).map(rowToReward);

    if (vehicleCategory) {
      rewards = rewards.filter(
        (r) => !r.vehicleCategory || r.vehicleCategory === 'all' || r.vehicleCategory === vehicleCategory,
      );
    }

    return rewards;
  }

  // Fallback
  return fallbackCatalog.filter((r) => {
    if (r.status !== 'active') return false;
    if (userType && r.userType !== 'all' && r.userType !== userType) return false;
    if (vehicleCategory && r.vehicleCategory && r.vehicleCategory !== 'all' && r.vehicleCategory !== vehicleCategory) return false;
    return true;
  });
}

// ── Get Reward By ID ────────────────────────────────────────

export async function getRewardById(id: string): Promise<Reward | undefined> {
  if (useSupabase()) {
    try {
      const { data } = await supabaseAdmin
        .from('rewards')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (data) return rowToReward(data);
    } catch {
      // Fall through to memory catalog
    }
  }

  return fallbackCatalog.find((r) => r.id === id);
}

// Re-export fallback for backwards compatibility
export const rewardCatalog = fallbackCatalog;
