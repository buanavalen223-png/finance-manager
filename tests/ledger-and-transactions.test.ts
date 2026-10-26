import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aggregateCategoryExpenseBreakdown,
  aggregateTransactionsReport,
  applyTransactionCreateToAccounts,
  applyTransactionDeleteToAccounts,
  applyTransactionUpdateToAccounts,
  assertValidTransactionEffect,
  buildMonthlyCashflowSeries,
  computeAccountBalanceFromTransactions,
  computeTotalActiveBalance,
} from '../src/lib/finance/ledger';
import { walletFormSchema } from '../src/schemas/wallet.schema';
import { categoryFormSchema } from '../src/schemas/category.schema';
import { transactionFormSchema } from '../src/schemas/transaction.schema';
import {
  createWallet,
  fetchWallets,
  setWalletArchived,
  updateWallet,
} from '../src/services/wallet.service';
import {
  createCategory,
  ensureDefaultCategories,
  fetchCategories,
} from '../src/services/category.service';
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '../src/services/transaction.service';
import type {
  AccountRow,
  CategoryRow,
  TransactionRow,
} from '../src/types/database.types';

/**
 * Simulator database PostgreSQL + RLS (`auth.uid() = user_id`) + Trigger Atomik
 * `sync_account_balance_on_transaction` untuk menguji siklus hidup penuh
 * Rekening, Kategori, dan Transaksi dari Service ke Database.
 */
function createLedgerMockSupabaseClient(
  activeAuthUid: string,
  db: {
    accounts: AccountRow[];
    categories: CategoryRow[];
    transactions: TransactionRow[];
  },
): SupabaseClient {
  let seq = 100;

  const adjustAccountBalance = (
    userId: string,
    accountId: string | null,
    delta: number,
  ) => {
    if (!accountId) return;
    const acc = db.accounts.find(
      (a) => a.id === accountId && a.user_id === userId,
    );
    if (acc) {
      acc.current_balance += delta;
    }
  };

  const applyTxEffectOnDb = (row: TransactionRow, multiplier: 1 | -1) => {
    if (row.type === 'income') {
      adjustAccountBalance(
        row.user_id,
        row.account_id,
        multiplier * row.amount,
      );
    } else if (row.type === 'expense') {
      adjustAccountBalance(
        row.user_id,
        row.account_id,
        -multiplier * row.amount,
      );
    } else if (row.type === 'transfer') {
      adjustAccountBalance(
        row.user_id,
        row.account_id,
        -multiplier * row.amount,
      );
      adjustAccountBalance(
        row.user_id,
        row.destination_account_id,
        multiplier * row.amount,
      );
    }
  };

  const client = {
    from(table: 'accounts' | 'categories' | 'transactions') {
      const eqFilters: Record<string, unknown> = {};
      let gteDate: string | null = null;
      let lteDate: string | null = null;
      let pendingInsert:
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let pendingDelete = false;

      const filterRows = <T extends { user_id: string }>(rows: T[]): T[] => {
        return rows.filter((row) => {
          if (row.user_id !== activeAuthUid) return false;
          for (const [k, v] of Object.entries(eqFilters)) {
            if ((row as Record<string, unknown>)[k] !== v) return false;
          }
          if (table === 'transactions') {
            const txDate = (row as unknown as TransactionRow).transaction_date;
            if (gteDate && txDate < gteDate) return false;
            if (lteDate && txDate > lteDate) return false;
          }
          return true;
        });
      };

      const executeMutation = (): {
        rows: Array<Record<string, unknown>>;
        error: Error | null;
      } => {
        if (pendingInsert) {
          const items = Array.isArray(pendingInsert)
            ? pendingInsert
            : [pendingInsert];
          const created: Array<Record<string, unknown>> = [];

          for (const item of items) {
            seq += 1;
            const newRow: Record<string, unknown> = {
              ...item,
              id: (item.id as string) ?? `${table}-${seq}`,
              user_id: activeAuthUid,
              created_at: '2026-10-26T10:00:00Z',
              updated_at: '2026-10-26T10:00:00Z',
            };
            (db[table] as unknown as Array<Record<string, unknown>>).unshift(
              newRow,
            );
            if (table === 'transactions') {
              applyTxEffectOnDb(newRow as unknown as TransactionRow, 1);
            }
            created.push(newRow);
          }
          pendingInsert = null;
          return { rows: created, error: null };
        }

        const matched = filterRows(
          db[table] as unknown as Array<{ user_id: string; id: string }>,
        ) as unknown as Array<Record<string, unknown>>;

        if (pendingUpdate) {
          if (matched.length === 0) {
            return {
              rows: [],
              error: new Error('Row not found or RLS blocked'),
            };
          }
          for (const target of matched) {
            if (table === 'transactions') {
              applyTxEffectOnDb(target as unknown as TransactionRow, -1);
            }
            Object.assign(target, pendingUpdate, {
              updated_at: '2026-10-26T11:00:00Z',
            });
            if (table === 'transactions') {
              applyTxEffectOnDb(target as unknown as TransactionRow, 1);
            }
          }
          pendingUpdate = null;
          return { rows: matched, error: null };
        }

        if (pendingDelete) {
          if (matched.length === 0) {
            return {
              rows: [],
              error: new Error('Row not found or RLS blocked'),
            };
          }
          for (const target of matched) {
            if (table === 'transactions') {
              applyTxEffectOnDb(target as unknown as TransactionRow, -1);
            }
            const arr = db[table] as unknown as Array<Record<string, unknown>>;
            const idx = arr.indexOf(target);
            if (idx !== -1) {
              arr.splice(idx, 1);
            }
          }
          pendingDelete = false;
          return { rows: matched, error: null };
        }

        return { rows: matched, error: null };
      };

      const builder = {
        select() {
          return builder;
        },
        insert(
          payload: Record<string, unknown> | Array<Record<string, unknown>>,
        ) {
          pendingInsert = payload;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          pendingUpdate = payload;
          return builder;
        },
        delete() {
          pendingDelete = true;
          return builder;
        },
        eq(col: string, val: unknown) {
          eqFilters[col] = val;
          return builder;
        },
        gte(col: string, val: string) {
          if (col === 'transaction_date') gteDate = val;
          return builder;
        },
        lte(col: string, val: string) {
          if (col === 'transaction_date') lteDate = val;
          return builder;
        },
        order() {
          return builder;
        },
        async maybeSingle() {
          const { rows, error } = executeMutation();
          return { data: rows[0] ?? null, error };
        },
        async single() {
          const { rows, error } = executeMutation();
          if (error || rows.length === 0) {
            return {
              data: null,
              error: error ?? new Error('Row not found'),
            };
          }
          return { data: rows[0], error: null };
        },
        then(
          resolve: (value: {
            data: Array<Record<string, unknown>> | null;
            error: Error | null;
          }) => unknown,
        ) {
          const { rows, error } = executeMutation();
          return Promise.resolve(resolve({ data: rows, error }));
        },
      };

      return builder;
    },
  };

  return client as unknown as SupabaseClient;
}

describe('Milestone 3: Core Ledger Engine, Balance Invariants, Transfer & Aggregations', () => {
  it('menghitung saldo rekening secara akurat dari saldo awal, pemasukan, pengeluaran, dan transfer', () => {
    const initialBca = 5_000_000;
    const initialGopay = 200_000;

    const ledgerEvents = [
      {
        type: 'income' as const,
        amount: 10_000_000,
        accountId: 'acc-bca',
      },
      {
        type: 'expense' as const,
        amount: 1_250_000,
        accountId: 'acc-bca',
      },
      {
        type: 'transfer' as const,
        amount: 1_500_000,
        accountId: 'acc-bca',
        destinationAccountId: 'acc-gopay',
      },
      {
        type: 'expense' as const,
        amount: 350_000,
        accountId: 'acc-gopay',
      },
    ];

    // BCA = 5.000.000 + 10.000.000 - 1.250.000 - 1.500.000 = 12.250.000
    expect(
      computeAccountBalanceFromTransactions('acc-bca', initialBca, ledgerEvents),
    ).toBe(12_250_000);

    // GoPay = 200.000 + 1.500.000 - 350.000 = 1.350.000
    expect(
      computeAccountBalanceFromTransactions(
        'acc-gopay',
        initialGopay,
        ledgerEvents,
      ),
    ).toBe(1_350_000);
  });

  it('memperbarui saldo secara atomik saat transaksi dibuat, diedit (ubah nominal/jenis/rekening), dan dihapus', () => {
    let accounts = [
      { id: 'acc-bank', currentBalance: 2_000_000, isArchived: false },
      { id: 'acc-cash', currentBalance: 500_000, isArchived: false },
    ];

    // 1. Tambah pengeluaran Rp 300.000 dari Bank
    const tx1 = {
      type: 'expense' as const,
      amount: 300_000,
      accountId: 'acc-bank',
    };
    accounts = applyTransactionCreateToAccounts(accounts, tx1);
    expect(accounts[0].currentBalance).toBe(1_700_000);
    expect(accounts[1].currentBalance).toBe(500_000);

    // 2. Edit tx1 menjadi transfer Rp 400.000 dari Bank ke Cash
    const tx1Edited = {
      type: 'transfer' as const,
      amount: 400_000,
      accountId: 'acc-bank',
      destinationAccountId: 'acc-cash',
    };
    accounts = applyTransactionUpdateToAccounts(accounts, tx1, tx1Edited);
    // Bank pulih +300.000 jadi 2.000.000, lalu dikurangi transfer 400.000 -> 1.600.000
    // Cash bertambah transfer +400.000 -> 900.000
    expect(accounts[0].currentBalance).toBe(1_600_000);
    expect(accounts[1].currentBalance).toBe(900_000);
    // Total kekayaan tetap Rp 2.500.000 saat transfer
    expect(computeTotalActiveBalance(accounts)).toBe(2_500_000);

    // 3. Hapus tx1Edited -> Saldo kembali ke kondisi awal (2.000.000 dan 500.000)
    accounts = applyTransactionDeleteToAccounts(accounts, tx1Edited);
    expect(accounts[0].currentBalance).toBe(2_000_000);
    expect(accounts[1].currentBalance).toBe(500_000);
  });

  it('tidak memasukkan transaksi transfer sebagai pemasukan maupun pengeluaran dalam laporan agregat', () => {
    const report = aggregateTransactionsReport([
      { type: 'income', amount: 8_000_000 },
      { type: 'expense', amount: 2_100_000 },
      { type: 'transfer', amount: 3_500_000 },
      { type: 'expense', amount: 400_000 },
    ]);

    expect(report.totalIncome).toBe(8_000_000);
    expect(report.totalExpense).toBe(2_500_000);
    expect(report.netCashflow).toBe(5_500_000);
    expect(report.totalTransferVolume).toBe(3_500_000);
    expect(report.transactionCount).toBe(4);

    const breakdown = aggregateCategoryExpenseBreakdown(
      [
        { type: 'expense', amount: 1_500_000, categoryId: 'cat-food' },
        { type: 'transfer', amount: 5_000_000, categoryId: null },
        { type: 'income', amount: 10_000_000, categoryId: 'cat-salary' },
      ],
      [
        { id: 'cat-food', name: 'Makanan', color: '#176B52', type: 'expense' },
        { id: 'cat-salary', name: 'Gaji', color: '#176B52', type: 'income' },
      ],
    );
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].amount).toBe(1_500_000);

    const series = buildMonthlyCashflowSeries(
      [
        {
          type: 'income',
          amount: 5_000_000,
          transactionDate: '2026-10-10',
        },
        {
          type: 'transfer',
          amount: 2_000_000,
          transactionDate: '2026-10-12',
        },
        {
          type: 'expense',
          amount: 1_200_000,
          transactionDate: '2026-10-15',
        },
      ],
      3,
      new Date(2026, 9, 26),
    );
    const octBucket = series.find((s) => s.yearMonth === '2026-10');
    expect(octBucket?.income).toBe(5_000_000);
    expect(octBucket?.expense).toBe(1_200_000);
  });

  it('menolak nominal nol, negatif, desimal/NaN, serta menolak transfer ke rekening yang sama', () => {
    // 1. Pemeriksaan level engine murni
    expect(() =>
      assertValidTransactionEffect({
        type: 'expense',
        amount: 0,
        accountId: 'acc-1',
      }),
    ).toThrow('lebih besar dari Rp 0');

    expect(() =>
      assertValidTransactionEffect({
        type: 'income',
        amount: -50_000,
        accountId: 'acc-1',
      }),
    ).toThrow('lebih besar dari Rp 0');

    expect(() =>
      assertValidTransactionEffect({
        type: 'expense',
        amount: 12500.75,
        accountId: 'acc-1',
      }),
    ).toThrow('bilangan bulat Rupiah');

    expect(() =>
      assertValidTransactionEffect({
        type: 'transfer',
        amount: 100_000,
        accountId: 'acc-same',
        destinationAccountId: 'acc-same',
      }),
    ).toThrow('rekening yang sama');

    // 2. Pemeriksaan level skema Zod (form transaksi & rekening)
    expect(
      transactionFormSchema.safeParse({
        type: 'expense',
        amount: 0,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        transactionDate: '2026-10-26',
        description: 'Nominal Nol',
      }).success,
    ).toBe(false);

    expect(
      transactionFormSchema.safeParse({
        type: 'expense',
        amount: -1000,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        transactionDate: '2026-10-26',
        description: 'Nominal Negatif',
      }).success,
    ).toBe(false);

    expect(
      transactionFormSchema.safeParse({
        type: 'transfer',
        amount: 250_000,
        accountId: 'acc-bca',
        destinationAccountId: 'acc-bca',
        transactionDate: '2026-10-26',
        description: 'Transfer ke rekening sendiri',
      }).success,
    ).toBe(false);

    expect(
      walletFormSchema.safeParse({
        name: 'Dompet Negatif',
        type: 'cash',
        initialBalance: -5000,
        color: '#176B52',
        icon: 'wallet',
      }).success,
    ).toBe(false);

    expect(
      categoryFormSchema.safeParse({
        name: 'A',
        type: 'expense',
        color: '#176B52',
        icon: 'tag',
      }).success,
    ).toBe(false);
  });

  it('menjalankan alur end-to-end service Rekening, Kategori, dan Transaksi (tambah, transfer, edit, hapus, filter, & isolasi kepemilikan)', async () => {
    const USER_A = '11111111-1111-4111-8111-111111111111';
    const USER_B = '22222222-2222-4222-8222-222222222222';

    const mockDb = {
      accounts: [
        {
          id: 'acc-b-foreign',
          user_id: USER_B,
          name: 'Rekening Milik User B',
          type: 'bank' as const,
          currency_code: 'IDR' as const,
          initial_balance: 99_000_000,
          current_balance: 99_000_000,
          color: '#176B52',
          icon: 'wallet',
          is_archived: false,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ],
      categories: [] as CategoryRow[],
      transactions: [] as TransactionRow[],
    };

    const clientA = createLedgerMockSupabaseClient(USER_A, mockDb);

    // 1. Inisialisasi kategori default + buat kategori kustom
    const defaultCats = await ensureDefaultCategories(USER_A, clientA);
    expect(defaultCats.length).toBeGreaterThanOrEqual(8);

    const customCat = await createCategory(
      USER_A,
      {
        name: 'Langganan SaaS',
        type: 'expense',
        color: '#176B52',
        icon: 'tag',
      },
      clientA,
    );
    expect(customCat.name).toBe('Langganan SaaS');

    const incomeCat = (await fetchCategories(USER_A, {}, clientA)).find(
      (c) => c.type === 'income',
    )!;

    // 2. Buat 2 rekening milik User A (Bank BCA & GoPay)
    const bca = await createWallet(
      USER_A,
      {
        name: 'BCA Utama',
        type: 'bank',
        initialBalance: 5_000_000,
        color: '#176B52',
        icon: 'wallet',
      },
      clientA,
    );
    const gopay = await createWallet(
      USER_A,
      {
        name: 'GoPay Harian',
        type: 'ewallet',
        initialBalance: 500_000,
        color: '#2B8A6E',
        icon: 'wallet',
      },
      clientA,
    );
    expect(bca.currentBalance).toBe(5_000_000);
    expect(gopay.currentBalance).toBe(500_000);

    // 3. Coba catat transaksi ke rekening milik User B -> Wajib ditolak!
    await expect(
      createTransaction(
        USER_A,
        {
          type: 'expense',
          amount: 100_000,
          accountId: 'acc-b-foreign',
          categoryId: customCat.id,
          transactionDate: '2026-10-26',
          description: 'Coba pakai rekening orang lain',
        },
        clientA,
      ),
    ).rejects.toThrow('bukan milik akun Anda');

    // 4. Catat Pemasukan Rp 3.000.000 ke BCA
    const txIncome = await createTransaction(
      USER_A,
      {
        type: 'income',
        amount: 3_000_000,
        accountId: bca.id,
        categoryId: incomeCat.id,
        transactionDate: '2026-10-25',
        description: 'Bonus Proyek Oktober',
      },
      clientA,
    );
    expect(txIncome.amount).toBe(3_000_000);

    // 5. Catat Transfer Rp 1.000.000 dari BCA ke GoPay
    const txTransfer = await createTransaction(
      USER_A,
      {
        type: 'transfer',
        amount: 1_000_000,
        accountId: bca.id,
        destinationAccountId: gopay.id,
        transactionDate: '2026-10-26',
        description: 'Topup GoPay',
      },
      clientA,
    );
    expect(txTransfer.type).toBe('transfer');

    // Verifikasi saldo setelah pemasukan & transfer:
    // BCA = 5.000.000 + 3.000.000 - 1.000.000 = 7.000.000
    // GoPay = 500.000 + 1.000.000 = 1.500.000
    let walletsAfter = await fetchWallets(USER_A, {}, clientA);
    expect(walletsAfter.find((w) => w.id === bca.id)?.currentBalance).toBe(
      7_000_000,
    );
    expect(walletsAfter.find((w) => w.id === gopay.id)?.currentBalance).toBe(
      1_500_000,
    );

    // 6. Edit transaksi transfer Rp 1.000.000 menjadi Pengeluaran Rp 400.000 di GoPay
    await updateTransaction(
      USER_A,
      txTransfer.id,
      {
        type: 'expense',
        amount: 400_000,
        accountId: gopay.id,
        categoryId: customCat.id,
        transactionDate: '2026-10-26',
        description: 'Bayar Langganan Cloud',
      },
      clientA,
    );

    // Setelah edit:
    // Efek transfer dibatalkan (BCA kembali 8.000.000, GoPay kembali 500.000)
    // Efek pengeluaran baru diterapkan ke GoPay (500.000 - 400.000 = 100.000)
    walletsAfter = await fetchWallets(USER_A, {}, clientA);
    expect(walletsAfter.find((w) => w.id === bca.id)?.currentBalance).toBe(
      8_000_000,
    );
    expect(walletsAfter.find((w) => w.id === gopay.id)?.currentBalance).toBe(
      100_000,
    );

    // 7. Edit saldo awal BCA dari 5.000.000 menjadi 6.000.000 (+1.000.000)
    const updatedBca = await updateWallet(
      USER_A,
      bca.id,
      {
        name: 'BCA Utama Prioritas',
        type: 'bank',
        initialBalance: 6_000_000,
        color: '#176B52',
        icon: 'wallet',
      },
      clientA,
    );
    expect(updatedBca.currentBalance).toBe(9_000_000);

    // 8. Uji pencarian & filter transaksi
    const filteredCloud = await fetchTransactions(
      USER_A,
      { search: 'Cloud' },
      clientA,
    );
    expect(filteredCloud.totalCount).toBe(1);
    expect(filteredCloud.items[0].description).toBe('Bayar Langganan Cloud');

    // 9. Hapus transaksi pengeluaran GoPay -> Saldo GoPay pulih menjadi 500.000
    await deleteTransaction(USER_A, txTransfer.id, clientA);
    walletsAfter = await fetchWallets(USER_A, {}, clientA);
    expect(walletsAfter.find((w) => w.id === gopay.id)?.currentBalance).toBe(
      500_000,
    );

    // 10. Arsipkan rekening GoPay -> tidak muncul di daftar aktif default
    await setWalletArchived(USER_A, gopay.id, true, clientA);
    const activeOnly = await fetchWallets(
      USER_A,
      { includeArchived: false },
      clientA,
    );
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe(bca.id);
  });
});
