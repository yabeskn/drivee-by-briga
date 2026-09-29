import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/baileys/manager';
import { createHash, randomBytes } from 'crypto';

// In-memory store (use Redis/Database in production)
const verificationStore = new Map<string, {
  token: string;
  phone: string;
  createdAt: number;
  expiresAt: number;
  verified: boolean;
}>();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    // Store verification data
    verificationStore.set(token, {
      token,
      phone,
      createdAt: now,
      expiresAt,
      verified: false,
    });

    // Generate verification link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://drivee.briga.id';
    const verifyLink = `${baseUrl}/verify?token=${token}`;

    // Send WhatsApp message
    const message = `Verifikasi nomor HP Anda di Drivee by Briga.\n\nKlik link berikut untuk verifikasi:\n${verifyLink}\n\nLink berlaku 10 menit.`;
    const result = await agentManager.sendMessage(phone, message);

    if (!result.success) {
      // Fallback: return link directly (for testing without active agents)
      return NextResponse.json({
        success: true,
        message: 'Verification link generated (WhatsApp not available)',
        data: {
          token,
          verifyLink,
          expiresAt,
          warning: 'No active WhatsApp agents. Use the link directly.',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification link sent via WhatsApp',
      data: {
        token,
        expiresAt,
        agentId: result.agentId,
      },
    });
  } catch (error) {
    console.error('[API] Verify phone error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const record = verificationStore.get(token);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    if (Date.now() > record.expiresAt) {
      verificationStore.delete(token);
      return NextResponse.json(
        { success: false, error: 'Token expired' },
        { status: 410 }
      );
    }

    if (record.verified) {
      return NextResponse.json({
        success: true,
        message: 'Phone already verified',
        data: { phone: record.phone, verified: true },
      });
    }

    // Mark as verified
    record.verified = true;
    verificationStore.set(token, record);

    return NextResponse.json({
      success: true,
      message: 'Phone verified successfully',
      data: { phone: record.phone, verified: true },
    });
  } catch (error) {
    console.error('[API] Verify token error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
