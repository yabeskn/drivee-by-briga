import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/baileys/manager';
import {
  createVerificationToken,
  verifyToken,
  generateDeviceId,
  getTokenStatus,
} from '@/lib/verification-store';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceId = generateDeviceId();

    // Create verification token
    const result = createVerificationToken(phone, 'phone_verification', ipAddress, userAgent, deviceId);

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 429 }
      );
    }

    const token = result;

    // Generate verification link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://drivee.briga.id';
    const verifyLink = `${baseUrl}/verify?token=${token.token}`;

    // Send WhatsApp message
    const message = `Verifikasi nomor HP Anda di Drifee by Briga.\n\nKlik link berikut untuk verifikasi:\n${verifyLink}\n\nLink berlaku 5 menit.`;
    const waResult = await agentManager.sendMessage(phone, message);

    if (!waResult.success) {
      // Fallback: return link directly (for testing without active agents)
      return NextResponse.json({
        success: true,
        message: 'Verification link generated (WhatsApp not available)',
        data: {
          token: token.token,
          verifyLink,
          expiresAt: token.expiresAt,
          deviceId,
          warning: 'No active WhatsApp agents. Use the link directly.',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification link sent via WhatsApp',
      data: {
        token: token.token,
        expiresAt: token.expiresAt,
        deviceId,
        agentId: waResult.agentId,
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
    const deviceId = searchParams.get('deviceId') || undefined;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const result = verifyToken(token, deviceId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Phone verified successfully',
        data: { phone: result.phone, verified: true },
      });
    } else {
      // Check if token exists for better error message
      const status = getTokenStatus(token);
      if (!status.exists) {
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 404 }
        );
      }
      if (status.expired) {
        return NextResponse.json(
          { success: false, error: 'Token expired' },
          { status: 410 }
        );
      }
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Verify token error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
