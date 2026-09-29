interface ActivityLogParams {
  driverId?: string;
  type: 'login' | 'trip' | 'verification' | 'app_usage' | 'error' | 'feature';
  action: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    await fetch('/api/activity/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error('[Activity Logger] Failed to log:', error);
  }
}

export function logLogin(driverId: string, method: string, status: string, metadata?: Record<string, unknown>) {
  return logActivity({
    driverId,
    type: 'login',
    action: `login_${method}`,
    status,
    metadata,
  });
}

export function logTrip(driverId: string, action: string, metadata?: Record<string, unknown>) {
  return logActivity({
    driverId,
    type: 'trip',
    action,
    metadata,
  });
}

export function logVerification(driverId: string, type: string, status: string, metadata?: Record<string, unknown>) {
  return logActivity({
    driverId,
    type: 'verification',
    action: `verify_${type}`,
    status,
    metadata,
  });
}

export function logError(driverId: string, error: string, metadata?: Record<string, unknown>) {
  return logActivity({
    driverId,
    type: 'error',
    action: 'error',
    status: 'error',
    metadata: { error, ...metadata },
  });
}

export function logFeatureUsage(driverId: string, feature: string, action: string, metadata?: Record<string, unknown>) {
  return logActivity({
    driverId,
    type: 'feature',
    action: `${feature}_${action}`,
    metadata,
  });
}
