import { z } from 'zod';

export const CATEGORY_TYPES = ['income', 'expense'] as const;

export const categoryTypeSchema = z.enum(CATEGORY_TYPES, {
  required_error: 'Jenis kategori wajib dipilih.',
  invalid_type_error: 'Jenis kategori harus Pemasukan atau Pengeluaran.',
});

export const categoryFormSchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(60, 'Nama kategori maksimal 60 karakter.'),
  type: categoryTypeSchema,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna harus HEX (#RRGGBB).'),
  icon: z.string().trim().min(1).max(40),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
