import { z } from 'zod';

const emailFieldSchema = z
  .string({ required_error: 'Alamat email wajib diisi.' })
  .trim()
  .min(1, 'Alamat email wajib diisi.')
  .email('Format alamat email tidak valid.');

const passwordFieldSchema = z
  .string({ required_error: 'Kata sandi wajib diisi.' })
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.');

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: z
    .string({ required_error: 'Kata sandi wajib diisi.' })
    .min(1, 'Kata sandi wajib diisi.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string({ required_error: 'Nama lengkap wajib diisi.' })
      .trim()
      .min(2, 'Nama lengkap minimal 2 karakter.')
      .max(80, 'Nama lengkap maksimal 80 karakter.'),
    email: emailFieldSchema,
    password: passwordFieldSchema,
    confirmPassword: z
      .string({ required_error: 'Konfirmasi kata sandi wajib diisi.' })
      .min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailFieldSchema,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    password: passwordFieldSchema,
    confirmPassword: z
      .string({ required_error: 'Konfirmasi kata sandi wajib diisi.' })
      .min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi baru tidak cocok.',
    path: ['confirmPassword'],
  });

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export const profileUpdateSchema = z.object({
  fullName: z
    .string({ required_error: 'Nama tampilan wajib diisi.' })
    .trim()
    .min(2, 'Nama tampilan minimal 2 karakter.')
    .max(80, 'Nama tampilan maksimal 80 karakter.'),
  themePreference: z.enum(['light', 'dark', 'system']),
});

export type ProfileUpdateFormValues = z.infer<typeof profileUpdateSchema>;

export const notificationPreferencesSchema = z.object({
  budgetAlertEnabled: z.boolean(),
  recurringReminderEnabled: z.boolean(),
  debtReminderEnabled: z.boolean(),
  weeklySummaryEnabled: z.boolean(),
  reminderDaysBefore: z
    .number({ invalid_type_error: 'Hari pengingat harus berupa angka bulat.' })
    .int('Hari pengingat harus berupa bilangan bulat.')
    .min(0, 'Minimal 0 hari sebelum jatuh tempo.')
    .max(30, 'Maksimal 30 hari sebelum jatuh tempo.'),
});

export type NotificationPreferencesFormValues = z.infer<
  typeof notificationPreferencesSchema
>;

