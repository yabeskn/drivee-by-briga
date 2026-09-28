import { NextRequest, NextResponse } from 'next/server';

interface DriverRegistrationRequest {
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
  licenseType: string;
  licenseNumber: string;
  licenseExpiry: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data: DriverRegistrationRequest = await request.json();

    // Validate required fields
    const requiredFields: (keyof DriverRegistrationRequest)[] = [
      'fullName', 'nationalId', 'phone', 'email', 'address',
      'licenseType', 'licenseNumber', 'licenseExpiry',
      'emergencyName', 'emergencyPhone', 'emergencyRelation',
      'bankName', 'accountNumber', 'accountHolder',
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { success: false, message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // TODO: Save to database
    // TODO: Send verification email
    // TODO: Create driver account

    return NextResponse.json({
      success: true,
      message: 'Driver registration received',
      data: {
        id: `drv_${Date.now()}`,
        status: 'pending_verification',
        ...data,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Driver registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
