/**
 * ============================================================================
 * FINORA AI — SINGLE SOURCE OF TRUTH: LEDGER & BALANCE CALCULATION ENGINE
 * ============================================================================
 * Seluruh aturan finansial buku besar (perhitungan saldo rekening, mutasi
 * pemasukan/pengeluaran/transfer atomik, pembatalan efek saat edit/hapus,
 * dan agregasi laporan tanpa pencemaran transfer) dipusatkan di modul murni ini.
 *
 * Semua nominal wajib berupa integer Rupiah (IDR).
 * ============================================================================
 */

import { addMoney, subtractMoney, toSafeRupiahInteger } from '@/lib/currency';
import { formatMonthYearID } from '@/lib/date';
import type { Account, Category, Transaction, TransactionType } from '@/types/domain';

export interface LedgerTransactionEffect {
  type: TransactionType;
  amount: number;
  accountId: string;
  destinationAccountId?: string | null;
}

export interface AggregatedPeriodSummary {
  totalIncome: number;
  totalExpense: number;
  totalTransferVolume: number;
  netCashflow: number;
  transactionCount: number;
}

export interface CategorySpendingBreakdown {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

export interface MonthlyCashflowPoint {
  month: string;
  yearMonth: string; // YYYY-MM
  income: number;
  expense: number;
}

/**
 * Memvalidasi invariant dasar mutasi transaksi sebelum menyentuh saldo.
 * Menolak nominal <= 0, nilai desimal/NaN, atau transfer ke rekening yang sama.
 */
export function assertValidTransactionEffect(effect: LedgerTransactionEffect): void {
  if (!Number.isFinite(effect.amount) || !Number.isInteger(effect.amount)) {
    throw new Error('Nominal transaksi harus berupa bilangan bulat Rupiah.');
  }
  const safeAmount = toSafeRupiahInteger(effect.amount);
  if (safeAmount <= 0) {
    throw new Error('Nominal transaksi harus lebih besar dari Rp 0.');
  }
  if (!effect.accountId || !effect.accountId.trim()) {
    throw new Error('Rekening sumber wajib dipilih.');
  }
  if (effect.type === 'transfer') {
    if (!effect.destinationAccountId || !effect.destinationAccountId.trim()) {
      throw new Error('Rekening tujuan wajib dipilih untuk transfer.');
    }
    if (effect.destinationAccountId.trim() === effect.accountId.trim()) {
      throw new Error('Tidak dapat melakukan transfer ke rekening yang sama.');
    }
  }
}

/**
 * Menghitung saldo berjalan (`currentBalance`) sebuah rekening murni dari
 * `initialBalance` dan daftar seluruh transaksi yang melibatkan rekening tersebut:
 *
 * currentBalance = initialBalance + SUM(income) - SUM(expense) - SUM(transfer_out) + SUM(transfer_in)
 */
export function computeAccountBalanceFromTransactions(
  accountId: string,
  initialBalance: number,
  transactions: ReadonlyArray<LedgerTransactionEffect>,
): number {
  let balance = toSafeRupiahInteger(initialBalance);

  for (const tx of transactions) {
    assertValidTransactionEffect(tx);

    if (tx.type === 'income' && tx.accountId === accountId) {
      balance = addMoney(balance, tx.amount);
    } else if (tx.type === 'expense' && tx.accountId === accountId) {
      balance = subtractMoney(balance, tx.amount);
    } else if (tx.type === 'transfer') {
      if (tx.accountId === accountId) {
        balance = subtractMoney(balance, tx.amount);
      } else if (tx.destinationAccountId === accountId) {
        balance = addMoney(balance, tx.amount);
      }
    }
  }

  return balance;
}

/**
 * Menghitung total saldo dari daftar rekening aktif (tidak diarsipkan).
 */
export function computeTotalActiveBalance(
  accounts: ReadonlyArray<Pick<Account, 'currentBalance' | 'isArchived'>>,
): number {
  return accounts
    .filter((acc) => !acc.isArchived)
    .reduce((sum, acc) => addMoney(sum, acc.currentBalance), 0);
}

/**
 * Menerapkan mutasi transaksi baru (`INSERT`) secara atomik pada koleksi rekening.
 */
export function applyTransactionCreateToAccounts<
  T extends Pick<Account, 'id' | 'currentBalance'>,
>(accounts: ReadonlyArray<T>, newTx: LedgerTransactionEffect): T[] {
  assertValidTransactionEffect(newTx);

  return accounts.map((acc) => {
    let nextBalance = toSafeRupiahInteger(acc.currentBalance);

    if (newTx.type === 'income' && acc.id === newTx.accountId) {
      nextBalance = addMoney(nextBalance, newTx.amount);
    } else if (newTx.type === 'expense' && acc.id === newTx.accountId) {
      nextBalance = subtractMoney(nextBalance, newTx.amount);
    } else if (newTx.type === 'transfer') {
      if (acc.id === newTx.accountId) {
        nextBalance = subtractMoney(nextBalance, newTx.amount);
      } else if (acc.id === newTx.destinationAccountId) {
        nextBalance = addMoney(nextBalance, newTx.amount);
      }
    }

    return nextBalance === acc.currentBalance
      ? acc
      : { ...acc, currentBalance: nextBalance };
  });
}

/**
 * Membatalkan efek transaksi (`DELETE`) secara atomik pada koleksi rekening.
 */
export function applyTransactionDeleteToAccounts<
  T extends Pick<Account, 'id' | 'currentBalance'>,
>(accounts: ReadonlyArray<T>, deletedTx: LedgerTransactionEffect): T[] {
  assertValidTransactionEffect(deletedTx);

  return accounts.map((acc) => {
    let nextBalance = toSafeRupiahInteger(acc.currentBalance);

    if (deletedTx.type === 'income' && acc.id === deletedTx.accountId) {
      nextBalance = subtractMoney(nextBalance, deletedTx.amount);
    } else if (deletedTx.type === 'expense' && acc.id === deletedTx.accountId) {
      nextBalance = addMoney(nextBalance, deletedTx.amount);
    } else if (deletedTx.type === 'transfer') {
      if (acc.id === deletedTx.accountId) {
        nextBalance = addMoney(nextBalance, deletedTx.amount);
      } else if (acc.id === deletedTx.destinationAccountId) {
        nextBalance = subtractMoney(nextBalance, deletedTx.amount);
      }
    }

    return nextBalance === acc.currentBalance
      ? acc
      : { ...acc, currentBalance: nextBalance };
  });
}

/**
 * Memperbarui efek transaksi (`UPDATE`) secara atomik:
 * membatalkan efek transaksi lama (`oldTx`), lalu menerapkan efek transaksi baru (`newTx`).
 */
export function applyTransactionUpdateToAccounts<
  T extends Pick<Account, 'id' | 'currentBalance'>,
>(
  accounts: ReadonlyArray<T>,
  oldTx: LedgerTransactionEffect,
  newTx: LedgerTransactionEffect,
): T[] {
  assertValidTransactionEffect(oldTx);
  assertValidTransactionEffect(newTx);

  const afterRevert = applyTransactionDeleteToAccounts(accounts, oldTx);
  return applyTransactionCreateToAccounts(afterRevert, newTx);
}

/**
 * Menghitung agregasi laporan pemasukan, pengeluaran, dan arus kas bersih.
 * ATURAN KEUANGAN WAJIB:
 * - Transaksi `transfer` TIDAK dihitung sebagai pemasukan maupun pengeluaran
 *   dalam laporan agregat.
 */
export function aggregateTransactionsReport(
  transactions: ReadonlyArray<Pick<Transaction, 'type' | 'amount'>>,
): AggregatedPeriodSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransferVolume = 0;

  for (const tx of transactions) {
    const safeAmount = toSafeRupiahInteger(tx.amount);
    if (safeAmount <= 0) {
      throw new Error('Ditemukan transaksi dengan nominal tidak valid (<= 0).');
    }

    if (tx.type === 'income') {
      totalIncome = addMoney(totalIncome, safeAmount);
    } else if (tx.type === 'expense') {
      totalExpense = addMoney(totalExpense, safeAmount);
    } else if (tx.type === 'transfer') {
      totalTransferVolume = addMoney(totalTransferVolume, safeAmount);
    }
  }

  return {
    totalIncome,
    totalExpense,
    totalTransferVolume,
    netCashflow: subtractMoney(totalIncome, totalExpense),
    transactionCount: transactions.length,
  };
}

/**
 * Mengelompokkan total pengeluaran per kategori (diurutkan dari terbesar).
 * Mengabaikan transaksi pemasukan dan transfer.
 */
export function aggregateCategoryExpenseBreakdown(
  transactions: ReadonlyArray<Pick<Transaction, 'type' | 'amount' | 'categoryId'>>,
  categories: ReadonlyArray<Pick<Category, 'id' | 'name' | 'color' | 'type'>>,
): CategorySpendingBreakdown[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const totalsByCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.categoryId) continue;
    const current = totalsByCategory.get(tx.categoryId) ?? 0;
    totalsByCategory.set(tx.categoryId, addMoney(current, tx.amount));
  }

  const result: CategorySpendingBreakdown[] = [];
  for (const [catId, amount] of totalsByCategory.entries()) {
    if (amount <= 0) continue;
    const cat = categoryMap.get(catId);
    result.push({
      categoryId: catId,
      name: cat?.name ?? 'Kategori Lainnya',
      color: cat?.color ?? '#176B52',
      amount,
    });
  }

  return result.sort((a, b) => b.amount - a.amount);
}

/**
 * Membangun deret waktu arus kas bulanan (6 bulan terakhir hingga tanggal acuan)
 * murni dari transaksi `income` dan `expense` (tanpa `transfer`).
 */
export function buildMonthlyCashflowSeries(
  transactions: ReadonlyArray<
    Pick<Transaction, 'type' | 'amount' | 'transactionDate'>
  >,
  monthsCount = 6,
  referenceDate: Date = new Date(),
): MonthlyCashflowPoint[] {
  const buckets: MonthlyCashflowPoint[] = [];
  const bucketMap = new Map<string, MonthlyCashflowPoint>();

  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - i,
      1,
    );
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const shortLabel = formatMonthYearID(month, year).split(' ')[0] ?? yearMonth;

    const point: MonthlyCashflowPoint = {
      month: shortLabel.slice(0, 3),
      yearMonth,
      income: 0,
      expense: 0,
    };
    buckets.push(point);
    bucketMap.set(yearMonth, point);
  }

  for (const tx of transactions) {
    if (tx.type === 'transfer') continue;
    const yearMonth = tx.transactionDate.slice(0, 7);
    const bucket = bucketMap.get(yearMonth);
    if (!bucket) continue;

    if (tx.type === 'income') {
      bucket.income = addMoney(bucket.income, tx.amount);
    } else if (tx.type === 'expense') {
      bucket.expense = addMoney(bucket.expense, tx.amount);
    }
  }

  return buckets;
}

