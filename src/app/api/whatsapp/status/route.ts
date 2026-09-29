import { NextResponse } from 'next/server';
import { agentManager } from '@/lib/baileys/manager';

export async function GET(): Promise<NextResponse> {
  try {
    const status = agentManager.getStatus();
    const activeCount = status.filter((s) => s.isActive).length;
    const totalCount = status.length;

    return NextResponse.json({
      success: true,
      data: {
        agents: status,
        summary: {
          total: totalCount,
          active: activeCount,
          inactive: totalCount - activeCount,
        },
      },
    });
  } catch (error) {
    console.error('[API] WhatsApp status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
