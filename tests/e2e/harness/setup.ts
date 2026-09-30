/**
 * Global Test Setup for E2E Tests
 * Provides network isolation so tests don't hang on remote OSRM or Supabase endpoints.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  // Intercept remote calls to prevent network timeouts during tests
  if (url.includes('supabase.co') || url.includes('project-osrm.org')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'content-range': '0-0/0',
      },
    });
  }

  if (originalFetch) {
    return originalFetch(input, init);
  }

  return new Response(JSON.stringify({}), { status: 200 });
};
