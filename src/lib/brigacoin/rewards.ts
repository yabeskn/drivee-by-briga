import { Reward, Redemption, VehicleCategory, UserType } from '@/types/telematics';

// ── Reward Catalog ──────────────────────────────────────────

export const rewardCatalog: Reward[] = [
  // Internal Rewards
  {
    id: 'int_001',
    name: 'Premium Analytics',
    description: 'Advanced trip analytics & reports for 30 days',
    category: 'internal',
    cost: 50,
    stock: 999,
    image: '/rewards/analytics.png',
    terms: 'Active for 30 days from redemption',
    type: 'feature',
    userType: 'driver',
    status: 'active',
  },
  {
    id: 'int_002',
    name: 'Subscription Discount 20%',
    description: '20% off briga.id subscription',
    category: 'internal',
    cost: 100,
    stock: 999,
    image: '/rewards/discount.png',
    terms: 'Valid for 1 subscription cycle',
    type: 'discount',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'int_003',
    name: 'Profile Boost',
    description: 'Highlight talent profile for 7 days',
    category: 'internal',
    cost: 80,
    stock: 999,
    image: '/rewards/boost.png',
    terms: 'Profile highlighted for 7 days',
    type: 'feature',
    userType: 'talent',
    status: 'active',
  },
  {
    id: 'int_004',
    name: 'Priority Support',
    description: 'Fast-track customer service',
    category: 'internal',
    cost: 30,
    stock: 999,
    image: '/rewards/support.png',
    terms: 'Valid for 30 days',
    type: 'service',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'int_005',
    name: 'Training Discount 15%',
    description: '15% off Briga Academy courses',
    category: 'internal',
    cost: 150,
    stock: 999,
    image: '/rewards/training.png',
    terms: 'Valid for 1 course enrollment',
    type: 'discount',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'int_006',
    name: 'Briga Merchandise',
    description: 'Briga branded items',
    category: 'internal',
    cost: 200,
    stock: 100,
    image: '/rewards/merch.png',
    terms: 'While stocks last',
    type: 'physical',
    userType: 'all',
    status: 'active',
  },

  // External Rewards - Voucher
  {
    id: 'ext_001',
    name: 'Voucher GoFood Rp 25K',
    description: 'GoFood voucher worth Rp 25,000',
    category: 'voucher',
    cost: 50,
    stock: 500,
    image: '/rewards/gofood.png',
    terms: 'Valid for 30 days',
    type: 'voucher',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'ext_002',
    name: 'Voucher Tokopedia Rp 50K',
    description: 'Tokopedia voucher worth Rp 50,000',
    category: 'voucher',
    cost: 100,
    stock: 500,
    image: '/rewards/tokopedia.png',
    terms: 'Valid for 30 days',
    type: 'voucher',
    userType: 'all',
    status: 'active',
  },

  // External Rewards - E-Wallet
  {
    id: 'ext_003',
    name: 'Top-up GoPay Rp 50K',
    description: 'GoPay top-up worth Rp 50,000',
    category: 'ewallet',
    cost: 100,
    stock: 500,
    image: '/rewards/gopay.png',
    terms: 'Auto-credit to GoPay account',
    type: 'auto_credit',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'ext_004',
    name: 'Top-up e-toll Rp 100K',
    description: 'Mandiri e-toll top-up worth Rp 100,000',
    category: 'transport',
    cost: 200,
    stock: 500,
    image: '/rewards/etoll.png',
    terms: 'Auto-credit to e-toll account',
    type: 'auto_credit',
    userType: 'all',
    status: 'active',
  },

  // External Rewards - Maintenance
  {
    id: 'ext_005',
    name: 'Servis Mobil Rp 200K',
    description: 'Car service voucher worth Rp 200,000',
    category: 'maintenance',
    cost: 300,
    stock: 200,
    image: '/rewards/servis.png',
    terms: 'Valid at partner workshops',
    type: 'voucher',
    userType: 'driver',
    status: 'active',
  },

  // External Rewards - Insurance
  {
    id: 'ext_006',
    name: 'Diskon Asuransi 10%',
    description: '10% discount on vehicle insurance',
    category: 'insurance',
    cost: 400,
    stock: 100,
    image: '/rewards/insurance.png',
    terms: 'Valid for 1 policy period',
    type: 'discount',
    userType: 'driver',
    status: 'active',
  },

  // Carbon Offset
  {
    id: 'carbon_001',
    name: 'Carbon Offset 10 kg CO₂',
    description: 'Offset 10 kg CO₂ emissions',
    category: 'carbon',
    cost: 5,
    stock: 9999,
    image: '/rewards/carbon.png',
    terms: 'Certificate provided',
    type: 'voucher',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'carbon_002',
    name: 'Carbon Offset 100 kg CO₂',
    description: 'Offset 100 kg CO₂ emissions',
    category: 'carbon',
    cost: 50,
    stock: 9999,
    image: '/rewards/carbon.png',
    terms: 'Certificate provided',
    type: 'voucher',
    userType: 'all',
    status: 'active',
  },
  {
    id: 'carbon_003',
    name: 'Carbon Offset 1 ton CO₂',
    description: 'Offset 1 ton CO₂ emissions',
    category: 'carbon',
    cost: 500,
    stock: 9999,
    image: '/rewards/carbon.png',
    terms: 'Certificate provided',
    type: 'voucher',
    userType: 'all',
    status: 'active',
  },
];

export function getRewards(
  userType?: UserType,
  vehicleCategory?: VehicleCategory
): Reward[] {
  return rewardCatalog.filter((r) => {
    if (r.status !== 'active') return false;
    if (r.userType !== 'all' && r.userType !== userType) return false;
    if (r.vehicleCategory && r.vehicleCategory !== 'all' && r.vehicleCategory !== vehicleCategory)
      return false;
    return true;
  });
}

export function getRewardById(id: string): Reward | undefined {
  return rewardCatalog.find((r) => r.id === id);
}
