import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import type {
  ForgotPasswordFormValues,
  LoginFormValues,
  RegisterFormValues,
  UpdatePasswordFormValues,
} from '@/schemas/auth.schema';

/**
 * Menerjemahkan pesan error teknis Supabase Auth ke bahasa Indonesia yang ramah
 * dan mudah dipahami pengguna tanpa membocorkan detail internal sistem.
 */
export function mapSupabaseAuthError(error: unknown): string {
  if (!error) {
    return 'Terjadi kesalahan yang tidak diketahui.';
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Email atau kata sandi yang Anda masukkan belum sesuai. Silakan periksa kembali.';
  }
  if (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered')
  ) {
    return 'Alamat email ini sudah terdaftar. Silakan masuk atau gunakan pemulihan kata sandi.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Alamat email Anda belum diverifikasi. Silakan periksa kotak masuk email Anda.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Kata sandi terlalu pendek. Gunakan minimal 8 karakter.';
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('security purposes')
  ) {
    return 'Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu beberapa saat sebelum mencoba lagi.';
  }
  if (normalized.includes('network') || normalized.includes('failed to fetch')) {
    return 'Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda.';
  }
  if (normalized.includes('konfigurasi supabase belum diatur')) {
    return rawMessage;
  }

  return 'Permintaan autentikasi tidak dapat diproses saat ini. Silakan coba kembali.';
}

export interface AuthActionResult {
  user: User | null;
  session: Session | null;
  requiresEmailConfirmation: boolean;
}

export async function signInWithEmail(
  values: LoginFormValues,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<AuthActionResult> {
  const { data, error } = await client.auth.signInWithPassword({
    email: values.email.trim().toLowerCase(),
    password: values.password,
  });

  if (error) {
    throw new Error(mapSupabaseAuthError(error));
  }

  return {
    user: data.user,
    session: data.session,
    requiresEmailConfirmation: false,
  };
}

export async function signUpWithEmail(
  values: RegisterFormValues,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<AuthActionResult> {
  const { data, error } = await client.auth.signUp({
    email: values.email.trim().toLowerCase(),
    password: values.password,
    options: {
      data: {
        full_name: values.fullName.trim(),
      },
    },
  });

  if (error) {
    throw new Error(mapSupabaseAuthError(error));
  }

  return {
    user: data.user,
    session: data.session,
    requiresEmailConfirmation: Boolean(data.user && !data.session),
  };
}

export async function signOutUser(
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(mapSupabaseAuthError(error));
  }
}

export async function sendPasswordResetEmail(
  values: ForgotPasswordFormValues,
  redirectUrl?: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  const targetRedirect =
    redirectUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/auth/lupa-sandi?mode=reset`
      : undefined);

  const { error } = await client.auth.resetPasswordForEmail(
    values.email.trim().toLowerCase(),
    targetRedirect ? { redirectTo: targetRedirect } : undefined,
  );

  if (error) {
    throw new Error(mapSupabaseAuthError(error));
  }
}

export async function updateUserPassword(
  values: UpdatePasswordFormValues,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  const { error } = await client.auth.updateUser({
    password: values.password,
  });

  if (error) {
    throw new Error(mapSupabaseAuthError(error));
  }
}

