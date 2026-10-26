/**
 * ============================================================================
 * FINORA AI — FINANCIAL PLANNING LOGIC ENGINE (MILESTONE 4)
 * ============================================================================
 * Modul murni (pure functions) untuk aturan kalkulasi:
 * 1. Realisasi anggaran per kategori & keseluruhan (eksklusi transfer).
 * 2. Progres target tabungan & simulasi kebutuhan tabungan berkala.
 * 3. Status utang/piutang (unpaid, partial, paid, overdue).
 * 4. Pemajuan tanggal jatuh tempo transaksi berulang & klasifikasi tagihan.
 *
 * Semua nominal uang wajib berupa integer Rupiah (IDR).
 * ============================================================================
 */

import {
  addMoney,
  calculatePercentage,
  subtractMoney,
  toSafeRupiahInteger,
} from '@/lib/currency';
import { toISODateString } from '@/lib/date';
import type {
  Budget,
  DebtRecord,
  RecurringFrequency,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from '@/types/domain';

export type BudgetAlertStatus = 'safe' | 'warning' | 'over';

export interface BudgetRealization {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  status: BudgetAlertStatus;
  isOverall: boolean;
}

export interface SavingsSimulation {
  remainingAmount: number;
  percentage: number;
  isCompleted: boolean;
  daysRemaining: number;
  weeksRemaining: number;
  monthsRemaining: number;
  requiredPerMonth: number;
  requiredPerWeek: number;
}

export type DebtDisplayStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

export type BillDueStatus = 'overdue' | 'due_today' | 'upcoming' | 'scheduled';

export interface UpcomingBillItem {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  dueDate: string;
  status: BillDueStatus;
  daysDiff: number;
  source: 'recurring' | 'debt';
  counterpartyName?: string;
  accountId?: string | null;
  categoryId?: string | null;
}

/**
 * Menghitung realisasi anggaran bulanan dari daftar transaksi periode terkait.
 * ATURAN KEUANGAN:
 * - HANYA transaksi bertipe 'expense' yang dihitung.
 * - Transaksi 'transfer' dan 'income' DILARANG dihitung sebagai pengeluaran anggaran.
 */
export function calculateBudgetRealization(
  budget: Budget,
  transactions: ReadonlyArray<Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'transactionDate'>>,
): BudgetRealization {
  const isOverall = budget.categoryId === null;
  const safeLimit = toSafeRupiahInteger(budget.amountLimit);

  const matchingExpenses = transactions.filter((tx) => {
    if (tx.type !== 'expense') return false;
    if (isOverall) return true;
    return tx.categoryId === budget.categoryId;
  });

  const spent = matchingExpenses.reduce(
    (total, tx) => addMoney(total, tx.amount),
    0,
  );

  const percentage = calculatePercentage(spent, safeLimit);
  const remaining = subtractMoney(safeLimit, spent);

  let status: BudgetAlertStatus = 'safe';
  if (percentage >= 100) {
    status = 'over';
  } else if (percentage >= (budget.alertThresholdPercent || 80)) {
    status = 'warning';
  }

  return {
    budget,
    spent,
    remaining,
    percentage,
    status,
    isOverall,
  };
}

/**
 * Menghitung progres tabungan dan simulasi kontribusi berkala yang dibutuhkan.
 */
export function simulateSavingsPlan(
  goal: Pick<SavingsGoal, 'targetAmount' | 'currentAmount' | 'targetDate' | 'status'>,
  referenceDate: Date = new Date(),
): SavingsSimulation {
  const safeTarget = toSafeRupiahInteger(goal.targetAmount);
  const safeCurrent = toSafeRupiahInteger(goal.currentAmount);
  const remainingAmount = Math.max(0, safeTarget - safeCurrent);
  const percentage = calculatePercentage(safeCurrent, safeTarget);
  const isCompleted = goal.status === 'completed' || remainingAmount === 0;

  if (isCompleted || !goal.targetDate) {
    return {
      remainingAmount,
      percentage,
      isCompleted,
      daysRemaining: 0,
      weeksRemaining: 0,
      monthsRemaining: 0,
      requiredPerMonth: remainingAmount,
      requiredPerWeek: remainingAmount,
    };
  }

  const target = new Date(goal.targetDate);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - ref.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4));

  const requiredPerMonth =
    daysRemaining <= 0
      ? remainingAmount
      : toSafeRupiahInteger(Math.ceil(remainingAmount / monthsRemaining));

  const requiredPerWeek =
    daysRemaining <= 0
      ? remainingAmount
      : toSafeRupiahInteger(Math.ceil(remainingAmount / weeksRemaining));

  return {
    remainingAmount,
    percentage,
    isCompleted,
    daysRemaining,
    weeksRemaining,
    monthsRemaining,
    requiredPerMonth,
    requiredPerWeek,
  };
}

/**
 * Mengidentifikasi status tampilan utang / piutang (termasuk status 'overdue').
 */
export function resolveDebtStatus(
  debt: Pick<DebtRecord, 'status' | 'remainingAmount' | 'principalAmount' | 'dueDate'>,
  today: string = toISODateString(),
): DebtDisplayStatus {
  if (debt.remainingAmount <= 0 || debt.status === 'paid') {
    return 'paid';
  }

  if (debt.dueDate && debt.dueDate < today) {
    return 'overdue';
  }

  if (debt.remainingAmount < debt.principalAmount || debt.status === 'partial') {
    return 'partial';
  }

  return 'unpaid';
}

/**
 * Menghitung tanggal jatuh tempo berikutnya berdasarkan frekuensi transaksi berulang.
 */
export function computeNextDueDate(
  currentDueDate: string,
  frequency: RecurringFrequency,
): string {
  const [year, month, day] = currentDueDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);

  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    // Tambah 1 bulan dengan penanganan overflow tanggal akhir bulan
    const targetMonth = d.getMonth() + 1;
    d.setMonth(targetMonth);
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }

  return toISODateString(d);
}

/**
 * Mengklasifikasikan status tenggat waktu tanggal jatuh tempo vs hari ini.
 */
export function classifyDueStatus(
  dueDate: string,
  today: string = toISODateString(),
  reminderDaysBefore = 3,
): { status: BillDueStatus; daysDiff: number } {
  const due = new Date(dueDate).getTime();
  const cur = new Date(today).getTime();
  const daysDiff = Math.round((due - cur) / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return { status: 'overdue', daysDiff };
  }
  if (daysDiff === 0) {
    return { status: 'due_today', daysDiff: 0 };
  }
  if (daysDiff <= reminderDaysBefore) {
    return { status: 'upcoming', daysDiff };
  }
  return { status: 'scheduled', daysDiff };
}

/**
 * Mengumpulkan daftar tagihan yang akan datang / jatuh tempo dari transaksi berulang
 * dan utang jatuh tempo untuk ditampilkan di Dashboard.
 */
export function getUpcomingBills(
  recurringTransactions: ReadonlyArray<RecurringTransaction>,
  debts: ReadonlyArray<DebtRecord>,
  today: string = toISODateString(),
  reminderDaysBefore = 7,
): UpcomingBillItem[] {
  const items: UpcomingBillItem[] = [];

  for (const item of recurringTransactions) {
    if (!item.isActive) continue;
    const { status, daysDiff } = classifyDueStatus(
      item.nextDueDate,
      today,
      reminderDaysBefore,
    );

    if (status === 'overdue' || status === 'due_today' || status === 'upcoming') {
      items.push({
        id: item.id,
        name: item.name,
        amount: item.amount,
        type: item.type,
        dueDate: item.nextDueDate,
        status,
        daysDiff,
        source: 'recurring',
        accountId: item.accountId,
        categoryId: item.categoryId,
      });
    }
  }

  for (const debt of debts) {
    if (debt.status === 'paid' || debt.remainingAmount <= 0 || !debt.dueDate) {
      continue;
    }
    const { status, daysDiff } = classifyDueStatus(
      debt.dueDate,
      today,
      reminderDaysBefore,
    );

    if (status === 'overdue' || status === 'due_today' || status === 'upcoming') {
      items.push({
        id: debt.id,
        name: `${debt.type === 'payable' ? 'Bayar Utang:' : 'Tagih Piutang:'} ${debt.counterpartyName}`,
        amount: debt.remainingAmount,
        type: debt.type === 'payable' ? 'expense' : 'income',
        dueDate: debt.dueDate,
        status,
        daysDiff,
        source: 'debt',
        counterpartyName: debt.counterpartyName,
      });
    }
  }

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
