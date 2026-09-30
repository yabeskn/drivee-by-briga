import { NextRequest, NextResponse } from 'next/server';
import { spendBalance, getBalance } from '@/lib/brigacoin/balance';
import { validateServiceAuth } from '@/lib/brigacoin/auth';
import { dispatchWebhookEvent } from '@/lib/brigacoin/webhooks';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateServiceAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const userId = (body.user_id as string)?.trim();
  const amount = body.amount;
  const source = (body.source as string)?.trim() || 'redemption';
  const description = (body.description as string)?.trim() || 'Redeemed BrigaCoins';
  const referenceId = (body.reference_id as string)?.trim() || undefined;
  const idempotencyKey = (body.idempotency_key as string)?.trim() || undefined;
  const actor = auth.actor === 'admin'
    ? ((body.actor as 'drifee' | 'briga' | 'system' | 'admin') || 'system')
    : (auth.actor || 'briga');
  const externalRef = (body.external_ref as string)?.trim() || undefined;

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PAYLOAD', message: 'user_id is required' },
      { status: 400 }
    );
  }

  if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PAYLOAD', message: 'amount must be a positive integer' },
      { status: 400 }
    );
  }

  try {
    const result = await spendBalance(
      userId,
      Math.floor(amount),
      source as 'trip' | 'bonus' | 'redemption' | 'referral' | 'adjustment' | 'carbon_offset',
      description,
      referenceId,
      {
        idempotencyKey,
        actor,
        externalRef,
        userId,
      }
    );

    if (!result.success) {
      if (result.error === 'Insufficient balance') {
        const current = await getBalance(userId);
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_BALANCE',
            message: 'Saldo koin tidak mencukupi untuk penukaran ini',
            balance: current.balance,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'SPEND_FAILED',
        },
        { status: 400 }
      );
    }

    // Asynchronously dispatch webhook (non-blocking)
    dispatchWebhookEvent('brigacoin.spent', {
      user_id: userId,
      amount: Math.floor(amount),
      balance: result.balance?.balance,
      ledger_id: result.ledgerId,
      reference_id: referenceId,
    }, actor).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        ledger_id: result.ledgerId,
        balance: result.balance?.balance,
        total_spent: result.balance?.totalSpent,
        duplicate: Boolean(result.duplicate),
      },
    });
  } catch (error) {
    console.error('[API Unified BrigaCoin] Spend error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Failed to process spend transaction' },
      { status: 500 }
    );
  }
}
