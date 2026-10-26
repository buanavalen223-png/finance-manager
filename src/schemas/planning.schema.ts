import { z } from 'zod';
import {
  isoDateStringSchema,
  nonNegativeRupiahSchema,
  positiveRupiahSchema,
} from './common.schema';

// ----------------------------------------------------------------------------
// 1. SKEMA FORM ANGGARAN (BUDGET)
// ----------------------------------------------------------------------------
export const budgetFormSchema = z.object({
  categoryId: z.string().trim().nullable().optional(),
  periodMonth: z
    .number({ required_error: 'Bulan periode wajib diisi.' })
    .int()
    .min(1)
    .max(12),
  periodYear: z
    .number({ required_error: 'Tahun periode wajib diisi.' })
    .int()
    .min(2000)
    .max(2100),
  amountLimit: positiveRupiahSchema,
  alertThresholdPercent: z
    .number({ required_error: 'Ambang batas peringatan wajib diisi.' })
    .int()
    .min(1, 'Minimal 1%.')
    .max(100, 'Maksimal 100%.'),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

// ----------------------------------------------------------------------------
// 2. SKEMA FORM TARGET TABUNGAN (SAVINGS GOAL) & KONTRIBUSI
// ----------------------------------------------------------------------------
export const savingsGoalFormSchema = z.object({
  name: z
    .string({ required_error: 'Nama target tabungan wajib diisi.' })
    .trim()
    .min(2, 'Nama target minimal 2 karakter.')
    .max(100, 'Nama target maksimal 100 karakter.'),
  targetAmount: positiveRupiahSchema,
  currentAmount: nonNegativeRupiahSchema,
  targetDate: z.string().trim().nullable().optional(),
  accountId: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

export type SavingsGoalFormValues = z.infer<typeof savingsGoalFormSchema>;

export const savingsContributionFormSchema = z.object({
  amount: positiveRupiahSchema,
  type: z.enum(['deposit', 'withdraw'], {
    required_error: 'Jenis mutasi alokasi wajib dipilih.',
  }),
  accountId: z.string().trim().nullable().optional(),
  contributionDate: isoDateStringSchema,
  notes: z.string().trim().max(250, 'Catatan maksimal 250 karakter.').optional(),
});

export type SavingsContributionFormValues = z.infer<
  typeof savingsContributionFormSchema
>;

// ----------------------------------------------------------------------------
// 3. SKEMA FORM UTANG & PIUTANG (DEBT) & PEMBAYARAN
// ----------------------------------------------------------------------------
export const debtFormSchema = z.object({
  type: z.enum(['payable', 'receivable'], {
    required_error: 'Pilih jenis utang atau piutang.',
  }),
  counterpartyName: z
    .string({ required_error: 'Nama pihak terkait wajib diisi.' })
    .trim()
    .min(2, 'Nama pihak terkait minimal 2 karakter.')
    .max(100, 'Nama pihak terkait maksimal 100 karakter.'),
  principalAmount: positiveRupiahSchema,
  dueDate: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

export type DebtFormValues = z.infer<typeof debtFormSchema>;

export const debtPaymentFormSchema = z.object({
  amount: positiveRupiahSchema,
  paymentDate: isoDateStringSchema,
  accountId: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(250, 'Catatan maksimal 250 karakter.').optional(),
});

export type DebtPaymentFormValues = z.infer<typeof debtPaymentFormSchema>;

// ----------------------------------------------------------------------------
// 4. SKEMA FORM TRANSAKSI BERULANG & TAGIHAN (RECURRING TRANSACTION)
// ----------------------------------------------------------------------------
export const recurringFrequencySchema = z.enum(
  ['daily', 'weekly', 'monthly', 'yearly'],
  {
    required_error: 'Frekuensi pengulangan wajib dipilih.',
  },
);

export const recurringTransactionFormSchema = z.object({
  name: z
    .string({ required_error: 'Nama transaksi/tagihan rutin wajib diisi.' })
    .trim()
    .min(2, 'Nama transaksi minimal 2 karakter.')
    .max(100, 'Nama transaksi maksimal 100 karakter.'),
  type: z.enum(['income', 'expense'], {
    required_error: 'Jenis transaksi wajib dipilih (Pemasukan/Pengeluaran).',
  }),
  amount: positiveRupiahSchema,
  frequency: recurringFrequencySchema,
  accountId: z.string().trim().nullable().optional(),
  categoryId: z.string().trim().nullable().optional(),
  nextDueDate: isoDateStringSchema,
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

export type RecurringTransactionFormValues = z.infer<
  typeof recurringTransactionFormSchema
>;

