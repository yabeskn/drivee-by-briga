// ─────────────────────────────────────────────────────────────
// brigacoin/sdk.ts — Unified BrigaCoin Client SDK
//
// Client SDK for briga.id web/mobile apps and partner services
// to interact with the Unified BrigaCoin system.
// ─────────────────────────────────────────────────────────────

import { BRC_TO_IDR } from './balance';
import { verifyWebhookSignature } from './webhooks';

export interface SDKConfig {
  baseUrl: string;
  serviceKey: string;
  webhookSecret?: string;
}

export interface UserBalanceResponse {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

export interface EarnParams {
  userId: string;
  amount: number;
  source: 'trip_reward' | 'streak' | 'carbon_offset' | 'bonus' | 'adjust';
  description: string;
  referenceId?: string;
  idempotencyKey?: string;
  externalRef?: string;
}

export interface SpendParams {
  userId: string;
  amount: number;
  source: 'redemption' | 'marketplace' | 'voucher' | 'partner_settlement';
  description: string;
  referenceId?: string;
  idempotencyKey?: string;
  externalRef?: string;
}

export interface MutationResponse {
  ledger_id: string;
  balance: number;
  total_earned?: number;
  total_spent?: number;
  duplicate: boolean;
}

export interface TransactionItem {
  id: string;
  user_id: string;
  type: 'earn' | 'spend' | 'expire' | 'adjust';
  amount: number;
  balance_after: number;
  source: string;
  reference_id: string | null;
  description: string;
  created_at: string;
}

export class UnifiedBrigaCoinSDK {
  private baseUrl: string;
  private serviceKey: string;
  private webhookSecret?: string;

  constructor(config: SDKConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.serviceKey = config.serviceKey;
    this.webhookSecret = config.webhookSecret;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceKey}`,
        ...options.headers,
      },
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || `HTTP ${res.status}`);
    }

    return json.data as T;
  }

  /** Ambil saldo koin pengguna */
  async getBalance(userId: string): Promise<UserBalanceResponse> {
    return this.request<UserBalanceResponse>(`/api/brigacoin/v1/balance/${encodeURIComponent(userId)}`);
  }

  /** Kredit koin dengan idempotency guard */
  async earn(params: EarnParams): Promise<MutationResponse> {
    return this.request<MutationResponse>('/api/brigacoin/v1/earn', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        amount: params.amount,
        source: params.source,
        description: params.description,
        reference_id: params.referenceId,
        idempotency_key: params.idempotencyKey || (params.referenceId ? `award:${params.referenceId}` : undefined),
        external_ref: params.externalRef,
        actor: 'briga',
      }),
    });
  }

  /** Debit koin untuk penukaran reward/voucher di ekosistem briga.id */
  async spend(params: SpendParams): Promise<MutationResponse> {
    return this.request<MutationResponse>('/api/brigacoin/v1/spend', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        amount: params.amount,
        source: params.source,
        description: params.description,
        reference_id: params.referenceId,
        idempotency_key: params.idempotencyKey || (params.referenceId ? `redeem:${params.referenceId}` : undefined),
        external_ref: params.externalRef,
        actor: 'briga',
      }),
    });
  }

  /** Riwayat transaksi */
  async getTransactions(userId: string): Promise<{ items: TransactionItem[]; next_cursor: string | null }> {
    return this.request<{ items: TransactionItem[]; next_cursor: string | null }>(
      `/api/brigacoin/v1/transactions/${encodeURIComponent(userId)}`
    );
  }

  /** Verifikasi tanda tangan webhook dari Drifee */
  verifyWebhook(body: string, signature: string): boolean {
    if (!this.webhookSecret) {
      throw new Error('webhookSecret is not configured in SDK');
    }
    return verifyWebhookSignature(body, signature, this.webhookSecret);
  }

  /** Konversi nilai BRC ke Rupiah (1 BRC = Rp 5.000) */
  static convertToIdr(brc: number): number {
    return brc * BRC_TO_IDR;
  }

  /** Konversi Rupiah ke BRC (dibulatkan ke bawah) */
  static convertToBrc(idr: number): number {
    return Math.floor(idr / BRC_TO_IDR);
  }
}
