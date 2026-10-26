import { describe, expect, it } from 'vitest';
import {
  calculateBudgetRealization,
  classifyDueStatus,
  computeNextDueDate,
  getUpcomingBills,
  resolveDebtStatus,
  simulateSavingsPlan,
} from '../src/lib/finance/planning';
import {
  budgetFormSchema,
  debtFormSchema,
  debtPaymentFormSchema,
  recurringTransactionFormSchema,
  savingsGoalFormSchema,
} from '../src/schemas/planning.schema';
import type {
  Budget,
  DebtRecord,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from '../src/types/domain';

describe('Finora AI Financial Planning Engine (Milestone 4)', () => {
  describe('1. Anggaran (Budget Realization & Business Invariants)', () => {
    const mockCategoryBudget: Budget = {
      id: 'b-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      periodMonth: 10,
      periodYear: 2026,
      amountLimit: 2000000,
      alertThresholdPercent: 80,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const mockOverallBudget: Budget = {
      id: 'b-2',
      userId: 'user-1',
      categoryId: null,
      periodMonth: 10,
      periodYear: 2026,
      amountLimit: 5000000,
      alertThresholdPercent: 85,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const sampleTransactions: ReadonlyArray<
      Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'transactionDate'>
    > = [
      {
        type: 'expense',
        amount: 500000,
        categoryId: 'cat-food',
        transactionDate: '2026-10-05',
      },
      {
        type: 'expense',
        amount: 800000,
        categoryId: 'cat-food',
        transactionDate: '2026-10-12',
      },
      {
        type: 'expense',
        amount: 1000000,
        categoryId: 'cat-transport',
        transactionDate: '2026-10-15',
      },
      // PENTING: Transfer DILARANG dihitung sebagai pengeluaran
      {
        type: 'transfer',
        amount: 2500000,
        categoryId: null,
        transactionDate: '2026-10-16',
      },
      // Pemasukan juga DILARANG dihitung sebagai pengeluaran
      {
        type: 'income',
        amount: 8000000,
        categoryId: 'cat-salary',
        transactionDate: '2026-10-25',
      },
    ];

    it('menghitung realisasi kategori secara tepat dan mengabaikan transaksi transfer dan income', () => {
      const result = calculateBudgetRealization(mockCategoryBudget, sampleTransactions);

      expect(result.spent).toBe(1300000); // 500.000 + 800.000
      expect(result.remaining).toBe(700000); // 2.000.000 - 1.300.000
      expect(result.percentage).toBe(65); // 1.300.000 / 2.000.000 = 65%
      expect(result.status).toBe('safe'); // < 80%
      expect(result.isOverall).toBe(false);
    });

    it('mendeteksi status warning saat pemakaian mencapai ambang batas dan over saat melebihi batas', () => {
      // 1. Uji Warning (85% pemakaian dengan threshold 80%)
      const warningBudget: Budget = {
        ...mockCategoryBudget,
        amountLimit: 1000000,
        alertThresholdPercent: 80,
      };
      const warningTxs = [
        {
          type: 'expense' as const,
          amount: 850000,
          categoryId: 'cat-food',
          transactionDate: '2026-10-20',
        },
      ];
      const warnResult = calculateBudgetRealization(warningBudget, warningTxs);
      expect(warnResult.percentage).toBe(85);
      expect(warnResult.status).toBe('warning');

      // 2. Uji Over (110% pemakaian)
      const overTxs = [
        {
          type: 'expense' as const,
          amount: 1100000,
          categoryId: 'cat-food',
          transactionDate: '2026-10-22',
        },
      ];
      const overResult = calculateBudgetRealization(warningBudget, overTxs);
      expect(overResult.percentage).toBe(110);
      expect(overResult.remaining).toBe(-100000);
      expect(overResult.status).toBe('over');
    });

    it('mendukung anggaran keseluruhan (overall) dengan menjumlahkan semua kategori pengeluaran tanpa transfer', () => {
      const overallResult = calculateBudgetRealization(mockOverallBudget, sampleTransactions);

      // Total expense: 500.000 (food) + 800.000 (food) + 1.000.000 (transport) = 2.300.000
      // Transfer 2.500.000 diabaikan sepenuhnya
      expect(overallResult.spent).toBe(2300000);
      expect(overallResult.remaining).toBe(2700000);
      expect(overallResult.percentage).toBe(46);
      expect(overallResult.isOverall).toBe(true);
    });
  });

  describe('2. Target Tabungan (Savings Simulation & Invariants)', () => {
    const mockGoal: SavingsGoal = {
      id: 'sg-1',
      userId: 'user-1',
      name: 'Dana Darurat 6 Bulan',
      targetAmount: 12000000,
      currentAmount: 3000000,
      targetDate: '2026-12-31',
      status: 'active',
      accountId: 'acc-1',
      notes: 'Disimpan di Bank Jago',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    it('menghitung sisa kebutuhan dana, persentase capaian, dan estimasi tabungan rutin', () => {
      const refDate = new Date('2026-10-01T00:00:00Z');
      const sim = simulateSavingsPlan(mockGoal, refDate);

      expect(sim.remainingAmount).toBe(9000000); // 12.000.000 - 3.000.000
      expect(sim.percentage).toBe(25);
      expect(sim.isCompleted).toBe(false);
      expect(sim.daysRemaining).toBe(91);
      expect(sim.weeksRemaining).toBe(13); // ceil(91 / 7)
      expect(sim.monthsRemaining).toBe(3); // ceil(91 / 30.4)
      expect(sim.requiredPerMonth).toBe(3000000); // 9.000.000 / 3
      expect(sim.requiredPerWeek).toBe(Math.ceil(9000000 / 13));
    });

    it('menandai status target tercapai saat tabungan terkumpul memenuhi atau melebihi target', () => {
      const completedGoal: SavingsGoal = {
        ...mockGoal,
        currentAmount: 12500000,
        status: 'completed',
      };
      const sim = simulateSavingsPlan(completedGoal);

      expect(sim.remainingAmount).toBe(0);
      expect(sim.percentage).toBe(104.2);
      expect(sim.isCompleted).toBe(true);
      expect(sim.requiredPerMonth).toBe(0);
      expect(sim.requiredPerWeek).toBe(0);
    });
  });

  describe('3. Utang & Piutang (Status Resolution & Payments)', () => {
    const today = '2026-10-26';

    it('mengidentifikasi status utang unpaid saat belum ada pembayaran', () => {
      const debt: Pick<DebtRecord, 'status' | 'remainingAmount' | 'principalAmount' | 'dueDate'> = {
        status: 'unpaid',
        principalAmount: 1000000,
        remainingAmount: 1000000,
        dueDate: '2026-11-15',
      };
      expect(resolveDebtStatus(debt, today)).toBe('unpaid');
    });

    it('mengidentifikasi status partial saat cicilan sebagian telah dibayarkan', () => {
      const debt: Pick<DebtRecord, 'status' | 'remainingAmount' | 'principalAmount' | 'dueDate'> = {
        status: 'partial',
        principalAmount: 1000000,
        remainingAmount: 400000,
        dueDate: '2026-11-15',
      };
      expect(resolveDebtStatus(debt, today)).toBe('partial');
    });

    it('mengidentifikasi status overdue saat jatuh tempo telah terlewat dan sisa > 0', () => {
      const debt: Pick<DebtRecord, 'status' | 'remainingAmount' | 'principalAmount' | 'dueDate'> = {
        status: 'unpaid',
        principalAmount: 1000000,
        remainingAmount: 500000,
        dueDate: '2026-10-20', // terlewat dari 2026-10-26
      };
      expect(resolveDebtStatus(debt, today)).toBe('overdue');
    });

    it('mengidentifikasi status paid saat sisa kewajiban adalah nol', () => {
      const debt: Pick<DebtRecord, 'status' | 'remainingAmount' | 'principalAmount' | 'dueDate'> = {
        status: 'paid',
        principalAmount: 1000000,
        remainingAmount: 0,
        dueDate: '2026-10-20',
      };
      expect(resolveDebtStatus(debt, today)).toBe('paid');
    });
  });

  describe('4. Transaksi Berulang & Tagihan (Siklus & Klasifikasi)', () => {
    it('memajukan tanggal jatuh tempo secara akurat untuk berbagai frekuensi', () => {
      expect(computeNextDueDate('2026-10-26', 'daily')).toBe('2026-10-27');
      expect(computeNextDueDate('2026-10-26', 'weekly')).toBe('2026-11-02');
      expect(computeNextDueDate('2026-10-26', 'monthly')).toBe('2026-11-26');
      expect(computeNextDueDate('2026-10-26', 'yearly')).toBe('2027-10-26');
    });

    it('mengklasifikasikan status tenggat tagihan (overdue, due_today, upcoming, scheduled)', () => {
      const today = '2026-10-26';
      expect(classifyDueStatus('2026-10-20', today).status).toBe('overdue');
      expect(classifyDueStatus('2026-10-26', today).status).toBe('due_today');
      expect(classifyDueStatus('2026-10-28', today, 3).status).toBe('upcoming');
      expect(classifyDueStatus('2026-11-15', today, 3).status).toBe('scheduled');
    });

    it('mengumpulkan tagihan terdekat dari transaksi berulang dan utang jatuh tempo', () => {
      const today = '2026-10-26';
      const recurringList: RecurringTransaction[] = [
        {
          id: 'rec-1',
          userId: 'user-1',
          name: 'Tagihan Listrik PLN',
          type: 'expense',
          amount: 450000,
          frequency: 'monthly',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          nextDueDate: '2026-10-28', // 2 hari lagi -> upcoming
          lastExecutedDate: null,
          isActive: true,
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'rec-2',
          userId: 'user-1',
          name: 'Langganan Hosting (Nonaktif)',
          type: 'expense',
          amount: 150000,
          frequency: 'monthly',
          accountId: null,
          categoryId: null,
          nextDueDate: '2026-10-25',
          lastExecutedDate: null,
          isActive: false, // Nonaktif -> diabaikan
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const debtsList: DebtRecord[] = [
        {
          id: 'd-1',
          userId: 'user-1',
          type: 'payable',
          counterpartyName: 'Koperasi Karyawan',
          principalAmount: 2000000,
          remainingAmount: 500000,
          dueDate: '2026-10-24', // Terlambat 2 hari -> overdue
          status: 'partial',
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'd-2',
          userId: 'user-1',
          type: 'payable',
          counterpartyName: 'Teman (Lunas)',
          principalAmount: 500000,
          remainingAmount: 0,
          dueDate: '2026-10-20',
          status: 'paid', // Lunas -> diabaikan
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const bills = getUpcomingBills(recurringList, debtsList, today, 7);

      expect(bills.length).toBe(2);
      // Urutan pertama adalah yang tanggalnya lebih awal (d-1: 2026-10-24, rec-1: 2026-10-28)
      expect(bills[0].id).toBe('d-1');
      expect(bills[0].status).toBe('overdue');
      expect(bills[1].id).toBe('rec-1');
      expect(bills[1].status).toBe('upcoming');
    });
  });

  describe('5. Skema Validasi Zod Perencanaan Keuangan', () => {
    it('memvalidasi skema anggaran bulanan dan menolak batas non-positif', () => {
      expect(
        budgetFormSchema.safeParse({
          categoryId: 'cat-1',
          periodMonth: 10,
          periodYear: 2026,
          amountLimit: 1500000,
          alertThresholdPercent: 80,
        }).success,
      ).toBe(true);

      // Anggaran keseluruhan (categoryId null) harus valid
      expect(
        budgetFormSchema.safeParse({
          categoryId: null,
          periodMonth: 10,
          periodYear: 2026,
          amountLimit: 5000000,
          alertThresholdPercent: 85,
        }).success,
      ).toBe(true);

      // Batas 0 atau negatif harus ditolak
      expect(
        budgetFormSchema.safeParse({
          categoryId: null,
          periodMonth: 10,
          periodYear: 2026,
          amountLimit: 0,
          alertThresholdPercent: 80,
        }).success,
      ).toBe(false);
    });

    it('memvalidasi skema target tabungan dan cicilan', () => {
      expect(
        savingsGoalFormSchema.safeParse({
          name: 'Beli Laptop Baru',
          targetAmount: 15000000,
          currentAmount: 2000000,
          targetDate: '2027-01-01',
        }).success,
      ).toBe(true);

      // Target <= 0 harus ditolak
      expect(
        savingsGoalFormSchema.safeParse({
          name: 'Target Kosong',
          targetAmount: 0,
          currentAmount: 0,
        }).success,
      ).toBe(false);
    });

    it('memvalidasi skema utang & pembayaran', () => {
      expect(
        debtFormSchema.safeParse({
          type: 'payable',
          counterpartyName: 'Ahmad Dahlan',
          principalAmount: 2500000,
          dueDate: '2026-12-01',
        }).success,
      ).toBe(true);

      expect(
        debtPaymentFormSchema.safeParse({
          amount: 500000,
          paymentDate: '2026-10-26',
        }).success,
      ).toBe(true);

      // Nominal pembayaran 0 harus ditolak
      expect(
        debtPaymentFormSchema.safeParse({
          amount: 0,
          paymentDate: '2026-10-26',
        }).success,
      ).toBe(false);
    });

    it('memvalidasi skema transaksi berulang', () => {
      expect(
        recurringTransactionFormSchema.safeParse({
          name: 'Indihome 50Mbps',
          type: 'expense',
          amount: 380000,
          frequency: 'monthly',
          nextDueDate: '2026-11-05',
        }).success,
      ).toBe(true);
    });
  });
});
