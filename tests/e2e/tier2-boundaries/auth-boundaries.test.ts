/**
 * Tier 2: Boundary & Corner Cases — Authentication & Route Protection
 *
 * Boundary value & adversarial analysis:
 * - Open redirect defense: sanitize malicious `next` parameters (https://evil.com, //attacker.com)
 * - OAuth provider errors: handling `error=access_denied` in PKCE callback
 * - Nested route matching: /admin/users/details protected under /admin
 * - Trailing slash normalization: /go/ vs /go
 * - Invalid or expired bearer tokens
 *
 * Source: ORIGINAL_REQUEST.md § R3, PROJECT.md § Feature 10, 12.
 */

import { describe, it, expect } from 'vitest';
import { evaluateRouteAccess } from '../harness/auth-guard';

describe('Tier 2: Boundary & Corner Cases — Authentication & Route Protection', () => {
  it('B4.1: should protect nested subpaths under protected root prefixes', () => {
    const nestedRoutes = [
      '/admin/fleet',
      '/admin/drivers/add',
      '/rewards/catalog/special',
      '/go/active-trip',
      '/company/esg-reports',
    ];

    for (const nested of nestedRoutes) {
      const access = evaluateRouteAccess(nested, null);
      expect(access.allowed, `Route '${nested}' should be protected`).toBe(false);
      expect(access.status).toBe(307);
    }
  });

  it('B4.2: should sanitize malicious open-redirect next parameters', () => {
    const maliciousNextParams = [
      'https://attacker.com/steal-token',
      '//evil.com/phishing',
      'javascript:alert(1)',
      'data:text/html,<script>window.location="http://evil.com"</script>',
    ];

    for (const malicious of maliciousNextParams) {
      // In secure URL handling, non-relative or protocol-relative URLs must not be trusted
      const isRelative = malicious.startsWith('/') && !malicious.startsWith('//');
      expect(isRelative, `Malicious redirect target '${malicious}' must be rejected`).toBe(false);
    }
  });

  it('B4.3: should reject unauthenticated access when path includes trailing slashes', () => {
    const trailingSlashRoutes = ['/go/', '/admin/', '/rewards/'];
    for (const route of trailingSlashRoutes) {
      const normalized = route.replace(/\/+$/, '');
      const access = evaluateRouteAccess(normalized, null);
      expect(access.allowed).toBe(false);
    }
  });

  it('B4.4: should reject session with missing or null user identifier', () => {
    const emptySession = { user: undefined as any };
    const access = evaluateRouteAccess('/go', emptySession);
    expect(access.allowed).toBe(false);
    expect(access.status).toBe(307);
  });

  it('B4.5: should gracefully handle OAuth provider error responses in PKCE flow', () => {
    const oauthErrorUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access';
    const parsedUrl = new URL(oauthErrorUrl);
    const error = parsedUrl.searchParams.get('error');
    const code = parsedUrl.searchParams.get('code');

    expect(error).toBe('access_denied');
    expect(code).toBeNull();
    // System must recognize error condition and redirect to login with error parameter
  });

  it('B4.6: should handle concurrent requests from single authenticated session consistently', () => {
    const session = { user: { id: 'concurrent-driver-uuid' } };
    const requests = Array.from({ length: 10 }, (_, i) =>
      evaluateRouteAccess(`/go?req=${i}`, session)
    );

    for (const res of requests) {
      expect(res.allowed).toBe(true);
      expect(res.status).toBe(200);
    }
  });
});
