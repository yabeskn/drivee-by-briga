import { NextRequest, NextResponse } from 'next/server';
import {
  createRentalOrder,
  getRentalOrders,
  getRentalOrderById,
  updatePaymentStatus,
  rentalPackages,
  calculateMonthlyEmission,
} from '@/lib/hr/rental';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const orderId = searchParams.get('orderId');

    if (orderId) {
      const order = getRentalOrderById(orderId);
      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: order });
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    const orders = getRentalOrders(companyId);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('[API] HR rentals error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, packageId, vehicleId, driverId, startDate, endDate } = await request.json();

    if (!companyId || !packageId || !vehicleId || !driverId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    const result = createRentalOrder(
      companyId,
      packageId,
      vehicleId,
      driverId,
      new Date(startDate),
      new Date(endDate)
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rental order created',
      data: result.order,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] HR rental create error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
