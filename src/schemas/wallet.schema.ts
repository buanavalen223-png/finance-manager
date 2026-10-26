import { z } from 'zod';
import { nonNegativeRupiahSchema } from './common.schema';

export const ACCOUNT_TYPES = [
  'cash',
  'bank',
  'ewallet',
  'investment',
  'other',
] as const;

export const accountTypeSchema = z.enum(ACCOUNT_TYPES, {
  required_error: 'Jenis rekening wajib dipilih.',
  invalid_type_error: 'Jenis rekening tidak valid.',
});

export const walletFormSchema = z.object({
  name: z
    .string({ required_error: 'Nama rekening wajib diisi.' })
    .trim()
    .min(2, 'Nama rekening minimal 2 karakter.')
    .max(80, 'Nama rekening maksimal 80 karakter.'),
  type: accountTypeSchema,
  initialBalance: nonNegativeRupiahSchema,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna harus HEX (#RRGGBB).'),
  icon: z.string().trim().min(1).max(40),
});

export type WalletFormValues = z.infer<typeof walletFormSchema>;
