import { BrigaCoinBalance, BrigaCoinTransaction } from '@/types/telematics';

// In-memory store (use database in production)
const balanceStore = new Map<string, BrigaCoinBalance>();
const transactionStore = new Map<string, BrigaCoinTransaction[]>();

export function getBalance(driverId: string): BrigaCoinBalance {
  return (
    balanceStore.get(driverId) || {
      driverId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      lastUpdated: new Date(),
    }
  );
}

export function addBalance(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string
): BrigaCoinBalance {
  const balance = getBalance(driverId);
  const newBalance = balance.balance + amount;

  const transaction: BrigaCoinTransaction = {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    driverId,
    type: amount > 0 ? 'earn' : 'spend',
    amount,
    balance: newBalance,
    source,
    referenceId,
    description,
    createdAt: new Date(),
  };

  balance.balance = newBalance;
  balance.totalEarned += Math.max(0, amount);
  balance.totalSpent += Math.max(0, -amount);
  balance.lastUpdated = new Date();

  balanceStore.set(driverId, balance);

  const transactions = transactionStore.get(driverId) || [];
  transactions.push(transaction);
  transactionStore.set(driverId, transactions);

  return balance;
}

export function spendBalance(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string
): { success: boolean; balance?: BrigaCoinBalance; error?: string } {
  const balance = getBalance(driverId);

  if (balance.balance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  return { success: true, balance: addBalance(driverId, -amount, source, description, referenceId) };
}

export function getTransactions(driverId: string): BrigaCoinTransaction[] {
  return transactionStore.get(driverId) || [];
}

export function getAllBalances(): BrigaCoinBalance[] {
  return Array.from(balanceStore.values());
}
