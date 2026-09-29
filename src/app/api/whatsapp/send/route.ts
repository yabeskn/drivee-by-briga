import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/baileys/manager';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone and message are required' },
        { status: 400 }
      );
    }

    const result = await agentManager.sendMessage(phone, message);

    if (result.success) {
      return NextResponse.json({
        success: true,
        agentId: result.agentId,
        message: 'Message sent successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('[API] WhatsApp send error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
