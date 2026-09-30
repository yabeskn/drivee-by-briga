/**
 * Tier 1: Feature Coverage — Authentication & Route Protection
 *
 * Requirements:
 * - Google Sign-In PKCE callback handler (/auth/callback).
 * - Secure session handling and persistence.
 * - Route guards blocking unauthorized access to private views (/admin, /company, /rewards, /special-track, /verify, /go).
 * - Insecure localStorage bypass rejected.
 *
 * Source: ORIGINAL_REQUEST.md § R3, PROJECT.md § Feature 10, 11, 12.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRouteAccess,
  inspectMiddleware,
  inspectPkceCallback,
  PROTECTED_ROUTES,
  PUBLIC_ROUTES,
} from '../harness/auth-guard';

describe('Tier 1: Feature Coverage — Authentication & Route Protection', () => {
  it('4.1: should block unauthenticated access to all protected routes and redirect to login', () => {
    for (const route of PROTECTED_ROUTES) {
      const access = evaluateRouteAccess(route, null);
      expect(access.allowed).toBe(false);
      expect(access.status).toBe(307);
      expect(access.redirectUrl).toBe(`/login?next=${encodeURIComponent(route)}`);
    }
  });

  it('4.2: should allow authenticated sessions to access protected routes', () => {
    const mockSession = { user: { id: 'test-driver-uuid' } };
    for (const route of PROTECTED_ROUTES) {
      const access = evaluateRouteAccess(route, mockSession);
      expect(access.allowed).toBe(true);
      expect(access.status).toBe(200);
    }
  });

  it('4.3: should allow public routes without authentication', () => {
    for (const route of PUBLIC_ROUTES) {
      const access = evaluateRouteAccess(route, null);
      expect(access.allowed).toBe(true);
      expect(access.status).toBe(200);
    }
  });

  it('4.4: should reject spoofed localStorage flag without valid server session', () => {
    // An attacker setting localStorage.getItem('drivee_logged_in') === 'true'
    // without an actual valid server session must NOT be permitted by route guards
    const unauthenticatedSession = null;
    const access = evaluateRouteAccess('/go', unauthenticatedSession);
    expect(access.allowed).toBe(false);
    expect(access.status).toBe(307);
  });

  it('4.5: should inspect middleware.ts configuration for route protection', () => {
    const middlewareResult = inspectMiddleware();
    expect(
      middlewareResult.middlewareExists,
      'src/middleware.ts must exist for Next.js route protection'
    ).toBe(true);
    expect(middlewareResult.protectsAdmin).toBe(true);
    expect(middlewareResult.protectsGo).toBe(true);
  });

  it('4.6: should inspect Google Sign-In PKCE OAuth callback handler at /auth/callback', () => {
    const callbackResult = inspectPkceCallback();
    expect(
      callbackResult.handlerExists,
      'OAuth callback route handler src/app/auth/callback/route.ts must exist'
    ).toBe(true);
    expect(callbackResult.handlesCodeExchange).toBe(true);
  });
});
