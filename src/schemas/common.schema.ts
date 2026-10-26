import { z } from 'zod';

/**
 * Skema Zod untuk memvalidasi nominal uang dalam integer Rupiah positif (> 0).
 * Menolak nilai desimal/floating-point, nol, atau negatif.
 */
export const positiveRupiahSchema = z
  .number({
    required_error: 'Nominal wajib diisi.',
    invalid_type_error: 'Nominal harus berupa angka bulat.',
  })
  .int('Nominal harus berupa bilangan bulat Rupiah tanpa desimal.')
  .positive('Nominal harus lebih besar dari Rp 0.')
  .max(Number.MAX_SAFE_INTEGER, 'Nominal melebihi batas maksimum yang diizinkan.');

/**
 * Skema Zod untuk nominal uang non-negatif (>= 0), misalnya untuk saldo awal dompet.
 */
export const nonNegativeRupiahSchema = z
  .number({
    required_error: 'Nominal wajib diisi.',
    invalid_type_error: 'Nominal harus berupa angka bulat.',
  })
  .int('Nominal harus berupa bilangan bulat Rupiah tanpa desimal.')
  .min(0, 'Nominal tidak boleh negatif.')
  .max(Number.MAX_SAFE_INTEGER, 'Nominal melebihi batas maksimum yang diizinkan.');

/**
 * Skema Zod untuk tanggal transaksi/jatuh tempo berformat YYYY-MM-DD.
 */
export const isoDateStringSchema = z
  .string({ required_error: 'Tanggal wajib diisi.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

