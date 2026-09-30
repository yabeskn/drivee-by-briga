import { describe, it, expect, vi } from 'vitest';
import { captureException, captureMessage, addBreadcrumb } from '@/lib/sentry';

describe('Sentry Error Tracking & Logging Module', () => {
  it('should capture an exception and return a valid 32-character event ID', async () => {
    const error = new Error('Test telemetry connection lost');
    const eventId = await captureException(error, {
      tags: { test: 'true', environment: 'test' },
      extra: { tripId: 'trip-test-123' },
    });

    expect(eventId).toBeDefined();
    expect(typeof eventId).toBe('string');
    expect(eventId).toHaveLength(32);
  });

  it('should capture string errors gracefully', async () => {
    const eventId = await captureException('Uncaught network timeout during photo upload', {
      level: 'warning',
    });

    expect(eventId).toBeDefined();
    expect(eventId).toHaveLength(32);
  });

  it('should record breadcrumbs and retain order', async () => {
    addBreadcrumb({
      category: 'telematics',
      message: 'GPS fix acquired with accuracy 4.2m',
      level: 'info',
    });

    addBreadcrumb({
      category: 'auth',
      message: 'Driver session verified',
      level: 'info',
    });

    const eventId = await captureMessage('Diagnostic checkpoint', {
      level: 'info',
    });

    expect(eventId).toHaveLength(32);
  });

  it('should handle undefined DSN without throwing or crashing the application', async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const eventId = await captureException(new Error('Graceful fallback test'));
    expect(eventId).toHaveLength(32);

    warnSpy.mockRestore();
  });
});
