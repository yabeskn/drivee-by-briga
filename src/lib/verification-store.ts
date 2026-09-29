import { randomBytes } from 'crypto';
import { logActivity } from '@/lib/activity/logger';

export interface VerificationToken {
  token: string;
  phone: string;
  purpose: 'phone_verification' | 'email_verification';
  createdAt: number;
  expiresAt: number;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

// File-based persistent storage (use Redis/DB in production)
const tokenStore = new Map<string, VerificationToken>();
const phoneRateLimit = new Map<string, { count: number; resetAt: number }>();
const ipRateLimit = new Map<string, { count: number; resetAt: number }>();

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;
const PHONE_RATE_LIMIT = 5; // per hour
const IP_RATE_LIMIT = 10; // per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateDeviceId(): string {
  return randomBytes(16).toString('hex');
}

export function createVerificationToken(
  phone: string,
  purpose: 'phone_verification' | 'email_verification',
  ipAddress?: string,
  userAgent?: string,
  deviceId?: string
): VerificationToken | { error: string } {
  const now = Date.now();

  // Check phone rate limit
  const phoneLimit = phoneRateLimit.get(phone);
  if (phoneLimit && now < phoneLimit.resetAt && phoneLimit.count >= PHONE_RATE_LIMIT) {
    return { error: 'Too many requests for this phone number. Try again later.' };
  }

  // Check IP rate limit
  if (ipAddress) {
    const ipLimit = ipRateLimit.get(ipAddress);
    if (ipLimit && now < ipLimit.resetAt && ipLimit.count >= IP_RATE_LIMIT) {
      return { error: 'Too many requests from this IP. Try again later.' };
    }
  }

  // Update rate limits
  if (phoneLimit && now < phoneLimit.resetAt) {
    phoneLimit.count++;
  } else {
    phoneRateLimit.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  if (ipAddress) {
    const ipLimit = ipRateLimit.get(ipAddress);
    if (ipLimit && now < ipLimit.resetAt) {
      ipLimit.count++;
    } else {
      ipRateLimit.set(ipAddress, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }
  }

  const token: VerificationToken = {
    token: generateToken(),
    phone,
    purpose,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
    verified: false,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    ipAddress,
    userAgent,
    deviceId,
  };

  tokenStore.set(token.token, token);

  // Log token creation
  logActivity({
    type: 'verification',
    action: 'token_created',
    status: 'pending',
    metadata: { phone, purpose },
  });

  return token;
}

export function verifyToken(
  token: string,
  deviceId?: string
): { success: boolean; phone?: string; error?: string } {
  const record = tokenStore.get(token);

  if (!record) {
    return { success: false, error: 'Invalid token' };
  }

  // Check if already verified
  if (record.verified) {
    return { success: false, error: 'Token already used' };
  }

  // Check expiry
  if (Date.now() > record.expiresAt) {
    tokenStore.delete(token);
    return { success: false, error: 'Token expired' };
  }

  // Check max attempts
  if (record.attempts >= record.maxAttempts) {
    tokenStore.delete(token);
    return { success: false, error: 'Max attempts exceeded' };
  }

  // Check device binding (if deviceId provided)
  if (deviceId && record.deviceId && deviceId !== record.deviceId) {
    record.attempts++;
    tokenStore.set(token, record);
    return { success: false, error: 'Device mismatch' };
  }

  // Mark as verified
  record.verified = true;
  tokenStore.set(token, record);

  // Log successful verification
  logActivity({
    type: 'verification',
    action: 'token_verified',
    status: 'verified',
    metadata: { phone: record.phone, purpose: record.purpose },
  });

  return { success: true, phone: record.phone };
}

export function getTokenStatus(token: string): {
  exists: boolean;
  verified: boolean;
  expired: boolean;
  attempts: number;
} {
  const record = tokenStore.get(token);
  if (!record) {
    return { exists: false, verified: false, expired: false, attempts: 0 };
  }
  return {
    exists: true,
    verified: record.verified,
    expired: Date.now() > record.expiresAt,
    attempts: record.attempts,
  };
}

export function cleanupExpiredTokens(): number {
  const now = Date.now();
  let count = 0;
  for (const [token, record] of tokenStore.entries()) {
    if (now > record.expiresAt) {
      tokenStore.delete(token);
      count++;
    }
  }
  return count;
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredTokens, 5 * 60 * 1000);
}
