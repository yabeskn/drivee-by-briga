// ─────────────────────────────────────────────────────────────
// lib/sentry.ts — Production-Ready Error Tracking for Drifee
//
// Zero-dependency Sentry-compatible event dispatcher.
// Works seamlessly in Next.js Server Components, API routes,
// and Client-side PWA environments.
// ─────────────────────────────────────────────────────────────

interface SentryBreadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

interface SentryEventOptions {
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id?: string; email?: string; role?: string };
  fingerprint?: string[];
}

const breadcrumbs: SentryBreadcrumb[] = [];
const MAX_BREADCRUMBS = 30;

function getDsn(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  }
  return undefined;
}

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];

    if (!publicKey || !host || !projectId) {
      return null;
    }

    return { publicKey, host, projectId };
  } catch {
    return null;
  }
}

function generateEventId(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Add a breadcrumb to the running context.
 */
export function addBreadcrumb(crumb: {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  breadcrumbs.push({
    timestamp: Date.now() / 1000,
    level: 'info',
    ...crumb,
  });

  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * Capture an exception and send to Sentry (or log in dev).
 */
export async function captureException(
  error: unknown,
  options?: SentryEventOptions
): Promise<string> {
  const eventId = generateEventId();
  const dsn = getDsn();

  const errMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  const stack = error instanceof Error ? error.stack : undefined;

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: options?.level || 'error',
    logger: 'drifee',
    environment: process.env.NODE_ENV || 'production',
    release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : 'Error',
          value: errMessage,
          stacktrace: stack ? { frames: parseStackTrace(stack) } : undefined,
        },
      ],
    },
    tags: {
      app: 'drifee-pwa',
      runtime: typeof window === 'undefined' ? 'node' : 'browser',
      ...(options?.tags || {}),
    },
    extra: {
      ...(options?.extra || {}),
    },
    breadcrumbs: [...breadcrumbs],
    user: options?.user,
  };

  if (!dsn) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Sentry (Offline)] Captured error: ${errMessage}`, {
        eventId,
        tags: payload.tags,
        extra: payload.extra,
      });
    }
    return eventId;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error('[Sentry] Invalid DSN configuration');
    return eventId;
  }

  const endpoint = `https://${parsed.host}/api/${parsed.projectId}/store/`;
  const authHeader = `Sentry sentry_version=7, sentry_client=drifee-sentry/1.0, sentry_key=${parsed.publicKey}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[Sentry] Failed to deliver event: HTTP ${res.status}`);
    }
  } catch (deliveryErr) {
    console.warn('[Sentry] Network error delivering telemetry:', deliveryErr);
  }

  return eventId;
}

/**
 * Capture a custom warning or message.
 */
export async function captureMessage(
  message: string,
  options?: SentryEventOptions
): Promise<string> {
  const eventId = generateEventId();
  const dsn = getDsn();

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: options?.level || 'info',
    logger: 'drifee',
    message,
    environment: process.env.NODE_ENV || 'production',
    tags: {
      app: 'drifee-pwa',
      runtime: typeof window === 'undefined' ? 'node' : 'browser',
      ...(options?.tags || {}),
    },
    extra: options?.extra,
    user: options?.user,
  };

  if (!dsn) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[Sentry (Offline)] Message: ${message}`, payload);
    }
    return eventId;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) return eventId;

  try {
    await fetch(`https://${parsed.host}/api/${parsed.projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=drifee-sentry/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking
  }

  return eventId;
}

function parseStackTrace(stack: string) {
  const lines = stack.split('\n').slice(1);
  return lines
    .map((line) => {
      const match = line.match(/^\s*at (?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (!match) return null;
      return {
        function: match[1] || '?',
        filename: match[2] || 'unknown',
        lineno: match[3] ? parseInt(match[3], 10) : undefined,
        colno: match[4] ? parseInt(match[4], 10) : undefined,
      };
    })
    .filter(Boolean);
}
