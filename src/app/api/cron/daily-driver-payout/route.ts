import { NextRequest, NextResponse } from 'next/server';
import { dispatchDailyPayoutReport } from '@/lib/payout/daily-payout-reporter';
import { validateServiceAuth } from '@/lib/brigacoin/auth';

export const dynamic = 'force-dynamic';

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const customHeader = request.headers.get('x-cron-secret');

  // 1. Direct CRON_SECRET match (e.g. Vercel Cron or GitHub Action)
  if (cronSecret && (token === cronSecret || customHeader === cronSecret)) {
    return true;
  }

  // 2. Admin / Drifee service token fallback
  const serviceAuth = validateServiceAuth(request);
  if (serviceAuth.authenticated && (serviceAuth.actor === 'admin' || serviceAuth.actor === 'drifee')) {
    return true;
  }

  // 3. Fallback when CRON_SECRET is not explicitly set in dev / test mode
  if (!cronSecret && process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: valid CRON_SECRET or service key required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;
  const recipient = searchParams.get('recipient') || undefined;

  try {
    const result = await dispatchDailyPayoutReport({
      date,
      recipientEmail: recipient,
    });

    return NextResponse.json({
      success: true,
      job: 'daily-driver-payout',
      executed_at: new Date().toISOString(),
      date: result.report.date,
      delivered: result.delivered,
      service_used: result.serviceUsed,
      recipient: result.recipient,
      file_path: result.filePath,
      summary: result.report.summary,
      drivers_count: result.report.drivers.length,
      drivers: result.report.drivers.map((d) => ({
        driver_name: d.driverName,
        driver_phone: d.driverPhone,
        bank_info: d.bankInfo,
        trip_count: d.tripCount,
        total_co2_kg: d.totalCo2AvoidedKg,
        total_payout_idr: d.totalPayoutIdr,
      })),
    });
  } catch (error) {
    console.error('[CRON Daily Driver Payout] Execution failure:', error);
    return NextResponse.json(
      { success: false, error: `Daily payout job failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: valid CRON_SECRET or service key required' },
      { status: 401 }
    );
  }

  try {
    let date: string | undefined;
    let recipient: string | undefined;

    try {
      const body = await request.json();
      date = body?.date;
      recipient = body?.recipient;
    } catch {
      // Body is optional
    }

    const result = await dispatchDailyPayoutReport({
      date,
      recipientEmail: recipient,
    });

    return NextResponse.json({
      success: true,
      job: 'daily-driver-payout',
      executed_at: new Date().toISOString(),
      date: result.report.date,
      delivered: result.delivered,
      service_used: result.serviceUsed,
      recipient: result.recipient,
      file_path: result.filePath,
      summary: result.report.summary,
      drivers_count: result.report.drivers.length,
      drivers: result.report.drivers.map((d) => ({
        driver_name: d.driverName,
        driver_phone: d.driverPhone,
        bank_info: d.bankInfo,
        trip_count: d.tripCount,
        total_co2_kg: d.totalCo2AvoidedKg,
        total_payout_idr: d.totalPayoutIdr,
      })),
    });
  } catch (error) {
    console.error('[CRON Daily Driver Payout] POST execution failure:', error);
    return NextResponse.json(
      { success: false, error: `Daily payout job failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
