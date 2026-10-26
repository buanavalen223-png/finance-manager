import { z } from 'zod';
import { isoDateStringSchema, positiveRupiahSchema } from './common.schema';

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES, {
  required_error: 'Jenis transaksi wajib dipilih.',
  invalid_type_error: 'Jenis transaksi tidak valid.',
});

export const transactionFormSchema = z
  .object({
    type: transactionTypeSchema,
    amount: positiveRupiahSchema,
    accountId: z
      .string({ required_error: 'Rekening/dompet wajib dipilih.' })
      .trim()
      .min(1, 'Rekening/dompet wajib dipilih.'),
    destinationAccountId: z.string().trim().optional().nullable(),
    categoryId: z.string().trim().optional().nullable(),
    transactionDate: isoDateStringSchema,
    description: z
      .string({ required_error: 'Catatan/deskripsi transaksi wajib diisi.' })
      .trim()
      .min(2, 'Catatan transaksi minimal 2 karakter.')
      .max(250, 'Catatan transaksi maksimal 250 karakter.'),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'transfer') {
      const destId = values.destinationAccountId?.trim() ?? '';
      if (!destId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationAccountId'],
          message: 'Rekening tujuan wajib dipilih untuk transaksi transfer.',
        });
      } else if (destId === values.accountId.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationAccountId'],
          message: 'Rekening tujuan tidak boleh sama dengan rekening sumber.',
        });
      }
    } else {
      const catId = values.categoryId?.trim() ?? '';
      if (!catId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['categoryId'],
          message: 'Kategori wajib dipilih untuk pemasukan atau pengeluaran.',
        });
      }
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export interface TransactionFilterParams {
  search?: string;
  type?: 'all' | 'income' | 'expense' | 'transfer';
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

