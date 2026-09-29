// ─────────────────────────────────────────────────────────────
// Supabase Database Schema — Drifee by Briga
//
// PostgreSQL schema via Supabase. This file defines the TypeScript
// types that mirror the database tables.
// ─────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string;
          google_id: string | null;
          email: string;
          name: string;
          phone: string | null;
          phone_verified: boolean;
          vehicle_id: string | null;
          briga_coin_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          google_id?: string | null;
          email: string;
          name: string;
          phone?: string | null;
          phone_verified?: boolean;
          vehicle_id?: string | null;
          briga_coin_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          google_id?: string | null;
          email?: string;
          name?: string;
          phone?: string | null;
          phone_verified?: boolean;
          vehicle_id?: string | null;
          briga_coin_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          driver_id: string;
          category: 'standard' | 'professional' | 'premium' | 'premium_plus';
          brand: string;
          model: string;
          license_plate: string;
          battery_capacity_kwh: number;
          status: 'active' | 'inactive';
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          category: 'standard' | 'professional' | 'premium' | 'premium_plus';
          brand: string;
          model: string;
          license_plate: string;
          battery_capacity_kwh: number;
          status?: 'active' | 'inactive';
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          category?: 'standard' | 'professional' | 'premium' | 'premium_plus';
          brand?: string;
          model?: string;
          license_plate?: string;
          battery_capacity_kwh?: number;
          status?: 'active' | 'inactive';
          created_at?: string;
        };
      };
      trips: {
        Row: {
          id: string;
          driver_id: string;
          vehicle_id: string;
          start_time: string;
          end_time: string | null;
          distance_km: number;
          eco_score: number;
          eco_grade: string;
          tokens_earned: number;
          trip_hash: string;
          verification_status: 'pending' | 'verified' | 'rejected';
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          vehicle_id: string;
          start_time: string;
          end_time?: string | null;
          distance_km?: number;
          eco_score?: number;
          eco_grade?: string;
          tokens_earned?: number;
          trip_hash?: string;
          verification_status?: 'pending' | 'verified' | 'rejected';
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          vehicle_id?: string;
          start_time?: string;
          end_time?: string | null;
          distance_km?: number;
          eco_score?: number;
          eco_grade?: string;
          tokens_earned?: number;
          trip_hash?: string;
          verification_status?: 'pending' | 'verified' | 'rejected';
          created_at?: string;
        };
      };
      brigacoin_transactions: {
        Row: {
          id: string;
          driver_id: string;
          type: 'earn' | 'spend' | 'expire' | 'adjust';
          amount: number;
          balance_after: number;
          source: string;
          reference_id: string | null;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          type: 'earn' | 'spend' | 'expire' | 'adjust';
          amount: number;
          balance_after: number;
          source: string;
          reference_id?: string | null;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          type?: 'earn' | 'spend' | 'expire' | 'adjust';
          amount?: number;
          balance_after?: number;
          source?: string;
          reference_id?: string | null;
          description?: string;
          created_at?: string;
        };
      };
      hr_rentals: {
        Row: {
          id: string;
          company_id: string;
          package_type: string;
          vehicle_id: string;
          driver_id: string;
          start_date: string;
          end_date: string;
          total_price: number;
          payment_status: 'pending' | 'paid' | 'verified';
          payment_reference: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          package_type: string;
          vehicle_id: string;
          driver_id: string;
          start_date: string;
          end_date: string;
          total_price: number;
          payment_status?: 'pending' | 'paid' | 'verified';
          payment_reference?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          package_type?: string;
          vehicle_id?: string;
          driver_id?: string;
          start_date?: string;
          end_date?: string;
          total_price?: number;
          payment_status?: 'pending' | 'paid' | 'verified';
          payment_reference?: string;
          created_at?: string;
        };
      };
      scope3_emissions: {
        Row: {
          id: string;
          company_id: string;
          rental_id: string;
          category: string;
          distance_km: number;
          emission_factor: number;
          total_emission_kg: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          rental_id: string;
          category: string;
          distance_km: number;
          emission_factor: number;
          total_emission_kg: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          rental_id?: string;
          category?: string;
          distance_km?: number;
          emission_factor?: number;
          total_emission_kg?: number;
          created_at?: string;
        };
      };
      carbon_offsets: {
        Row: {
          id: string;
          company_id: string;
          amount_kg: number;
          type: string;
          cost: number;
          brc_earned: number;
          certificate_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          amount_kg: number;
          type: string;
          cost: number;
          brc_earned: number;
          certificate_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          amount_kg?: number;
          type?: string;
          cost?: number;
          brc_earned?: number;
          certificate_url?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
