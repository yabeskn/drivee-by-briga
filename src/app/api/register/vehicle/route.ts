import { NextRequest, NextResponse } from 'next/server';

interface VehicleRegistrationRequest {
  type: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  ownershipStatus: 'company' | 'leased' | 'personal' | 'consortium';
  leasingCompany?: string;
  contractEnd?: string;
  consortiumName?: string;
  consortiumMembers?: string;
  licensePlate: string;
  chassisNumber: string;
  engineNumber: string;
  stnkExpiry: string;
  batteryCapacity: string;
  odometer: string;
  vehiclePhoto: File | null;
  stnkPhoto: File | null;
  bpkbPhoto: File | null;
  leasingContract?: File | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data: VehicleRegistrationRequest = await request.json();

    // Validate required fields
    const requiredFields: (keyof VehicleRegistrationRequest)[] = [
      'type', 'brand', 'model', 'year', 'color',
      'ownershipStatus', 'licensePlate', 'chassisNumber',
      'engineNumber', 'stnkExpiry', 'batteryCapacity', 'odometer',
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { success: false, message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate ownership-specific fields
    if (data.ownershipStatus === 'leased' && (!data.leasingCompany || !data.contractEnd)) {
      return NextResponse.json(
        { success: false, message: 'Leasing company and contract end date are required for leased vehicles' },
        { status: 400 }
      );
    }

    if (data.ownershipStatus === 'consortium' && (!data.consortiumName || !data.consortiumMembers)) {
      return NextResponse.json(
        { success: false, message: 'Consortium name and members are required for consortium vehicles' },
        { status: 400 }
      );
    }

    // TODO: Save to database
    // TODO: Process uploaded files
    // TODO: Send verification email
    // TODO: Create vehicle record

    return NextResponse.json({
      success: true,
      message: 'Vehicle registration received',
      data: {
        id: `veh_${Date.now()}`,
        status: 'pending_verification',
        ...data,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Vehicle registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
