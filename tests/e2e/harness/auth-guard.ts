/**
 * Authentication and Route Protection Test Harness
 * Evaluates route guard contracts, session persistence, and PKCE callback behaviors.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROTECTED_ROUTES = [
  '/admin',
  '/company',
  '/rewards',
  '/special-track',
  '/verify',
  '/go',
];

export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/landing',
  '/auth/callback',
];

export interface RouteAccessCheck {
  route: string;
  isAuthenticated: boolean;
  expectedStatus: number; // 200 (allow) or 302/307 (redirect to login) or 401 (unauthorized)
  expectedLocationPrefix?: string;
}

export interface MiddlewareInspectionResult {
  middlewareExists: boolean;
  middlewarePath: string;
  protectsAdmin: boolean;
  protectsGo: boolean;
  protectsRewards: boolean;
  protectsSpecialTrack: boolean;
  protectsCompany: boolean;
  protectsVerify: boolean;
  hasSessionCheck: boolean;
  sanitizesNextRedirect: boolean;
  violations: string[];
}

export function inspectMiddleware(): MiddlewareInspectionResult {
  const possiblePaths = [
    resolve(process.cwd(), 'src/middleware.ts'),
    resolve(process.cwd(), 'middleware.ts'),
  ];

  let foundPath = '';
  let content = '';
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      foundPath = p;
      content = readFileSync(p, 'utf-8');
      break;
    }
  }

  const result: MiddlewareInspectionResult = {
    middlewareExists: Boolean(foundPath),
    middlewarePath: foundPath,
    protectsAdmin: false,
    protectsGo: false,
    protectsRewards: false,
    protectsSpecialTrack: false,
    protectsCompany: false,
    protectsVerify: false,
    hasSessionCheck: false,
    sanitizesNextRedirect: false,
    violations: [],
  };

  if (!foundPath) {
    result.violations.push('Route protection middleware file (src/middleware.ts) is missing');
    return result;
  }

  result.protectsAdmin = /admin/i.test(content);
  result.protectsGo = /go/i.test(content);
  result.protectsRewards = /rewards/i.test(content);
  result.protectsSpecialTrack = /special-track/i.test(content);
  result.protectsCompany = /company/i.test(content);
  result.protectsVerify = /verify/i.test(content);
  result.hasSessionCheck = /(?:session|token|auth|getUser|getSession)/i.test(content);
  result.sanitizesNextRedirect = /(?:startsWith\(['"]\/['"]\)|URL|pathname)/i.test(content);

  for (const route of PROTECTED_ROUTES) {
    const routeKey = route.replace('/', '');
    const isProtected = new RegExp(routeKey, 'i').test(content);
    if (!isProtected) {
      result.violations.push(`Middleware matcher or logic does not explicitly protect route: ${route}`);
    }
  }

  return result;
}

export interface PkceCallbackInspectionResult {
  handlerExists: boolean;
  handlerPath: string;
  handlesCodeExchange: boolean;
  handlesErrorQuery: boolean;
  redirectsToDestination: boolean;
  sanitizesNextParam: boolean;
  violations: string[];
}

export function inspectPkceCallback(): PkceCallbackInspectionResult {
  const handlerPath = resolve(process.cwd(), 'src/app/auth/callback/route.ts');
  const exists = existsSync(handlerPath);

  const result: PkceCallbackInspectionResult = {
    handlerExists: exists,
    handlerPath,
    handlesCodeExchange: false,
    handlesErrorQuery: false,
    redirectsToDestination: false,
    sanitizesNextParam: false,
    violations: [],
  };

  if (!exists) {
    result.violations.push('Google PKCE OAuth callback handler (src/app/auth/callback/route.ts) is missing');
    return result;
  }

  const content = readFileSync(handlerPath, 'utf-8');
  result.handlesCodeExchange = /exchangeCodeForSession/i.test(content);
  result.handlesErrorQuery = /(?:error|error_description)/i.test(content);
  result.redirectsToDestination = /NextResponse\.redirect/i.test(content);
  result.sanitizesNextParam = /(?:startsWith\(['"]\/['"]\)|next\.startsWith)/i.test(content);

  if (!result.handlesCodeExchange) {
    result.violations.push('PKCE handler does not call exchangeCodeForSession');
  }

  return result;
}

/**
 * Pure route guard evaluator based on the specification
 */
export function evaluateRouteAccess(
  pathname: string,
  session: { user?: { id: string } } | null
): { allowed: boolean; redirectUrl?: string; status: number } {
  const isProtected = PROTECTED_ROUTES.some(pr => pathname === pr || pathname.startsWith(pr + '/'));

  if (!isProtected) {
    return { allowed: true, status: 200 };
  }

  if (!session || !session.user) {
    return {
      allowed: false,
      redirectUrl: `/login?next=${encodeURIComponent(pathname)}`,
      status: 307,
    };
  }

  return { allowed: true, status: 200 };
}
