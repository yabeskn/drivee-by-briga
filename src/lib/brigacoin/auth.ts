// ─────────────────────────────────────────────────────────────
// brigacoin/auth.ts — Server-to-Server Service Authentication
//
// Validates Bearer token or x-api-key for unified BrigaCoin
// server-to-server API endpoints (Drifee ↔ briga.id ecosystem).
// ─────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server';

export interface ServiceAuthResult {
  authenticated: boolean;
  actor?: 'drifee' | 'briga' | 'admin' | 'system';
  error?: string;
}

export function validateServiceAuth(request: NextRequest): ServiceAuthResult {
  // Extract token from Authorization: Bearer <token> or x-api-key header
  const authHeader = request.headers.get('authorization');
  let token = '';

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    token = request.headers.get('x-api-key')?.trim() || '';
  }

  if (!token) {
    return {
      authenticated: false,
      error: 'Missing Authorization header with Bearer token or x-api-key',
    };
  }

  const brigaKey = process.env.BRIGA_SERVICE_KEY;
  const drifeeKey = process.env.DRIFEE_SERVICE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (brigaKey && token === brigaKey) {
    return { authenticated: true, actor: 'briga' };
  }

  if (drifeeKey && token === drifeeKey) {
    return { authenticated: true, actor: 'drifee' };
  }

  if (supabaseServiceKey && token === supabaseServiceKey) {
    return { authenticated: true, actor: 'admin' };
  }

  // Development & Test fallback for automated suites
  const isDevOrTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  if (isDevOrTest && (token === 'test-service-key-briga' || token === 'test-service-key-drifee' || token === 'test-admin-key')) {
    return {
      authenticated: true,
      actor: token === 'test-service-key-briga' ? 'briga' : token === 'test-service-key-drifee' ? 'drifee' : 'admin',
    };
  }

  return {
    authenticated: false,
    error: 'Invalid service token',
  };
}
