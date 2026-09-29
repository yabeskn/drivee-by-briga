import { NextRequest, NextResponse } from 'next/server';

interface DriverCRMData {
  googleId?: string;
  email: string;
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  ktp?: string;
  simType?: string;
  simNumber?: string;
  simExpiry?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  bankName?: string;
  bankOther?: string;
  accountNumber?: string;
  accountHolder?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data: DriverCRMData = await request.json();

    // Validate required fields
    if (!data.email || !data.fullName || !data.phone) {
      return NextResponse.json(
        { success: false, error: 'Email, fullName, and phone are required' },
        { status: 400 }
      );
    }

    // Validate phone is verified
    if (!data.phoneVerified) {
      return NextResponse.json(
        { success: false, error: 'Phone number must be verified' },
        { status: 400 }
      );
    }

    // TODO: Save to database
    // TODO: Trigger verification workflow
    // TODO: Send confirmation email

    return NextResponse.json({
      success: true,
      message: 'Driver registered successfully',
      data: {
        id: `drv_${Date.now()}`,
        status: 'pending_verification',
        ...data,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[API] CRM driver registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('id');

    if (!driverId) {
      return NextResponse.json(
        { success: false, error: 'Driver ID is required' },
        { status: 400 }
      );
    }

    // TODO: Fetch from database
    return NextResponse.json({
      success: true,
      data: {
        id: driverId,
        status: 'pending_verification',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
