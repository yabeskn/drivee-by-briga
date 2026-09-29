import { NextRequest, NextResponse } from 'next/server';

interface ActivityLog {
  driverId?: string;
  type: 'login' | 'trip' | 'verification' | 'app_usage' | 'error' | 'feature';
  action: string;
  status?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data: ActivityLog = await request.json();

    // Get IP and User-Agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const logEntry: ActivityLog = {
      ...data,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    };

    // TODO: Save to database
    console.log('[Activity]', logEntry);

    return NextResponse.json({
      success: true,
      message: 'Activity logged',
    });
  } catch (error) {
    console.error('[API] Activity log error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
