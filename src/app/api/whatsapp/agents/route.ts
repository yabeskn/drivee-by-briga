import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/baileys/manager';

export async function GET(): Promise<NextResponse> {
  try {
    const agents = agentManager.getStatus();
    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { agentId, status, phone } = await request.json();

    if (!agentId || !status) {
      return NextResponse.json(
        { success: false, error: 'agentId and status are required' },
        { status: 400 }
      );
    }

    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // TODO: Update agent config in database/file
    // TODO: Connect/disconnect agent based on status

    return NextResponse.json({
      success: true,
      message: `Agent ${agentId} status updated to ${status}`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
