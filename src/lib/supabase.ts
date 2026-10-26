import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

/**
 * Memeriksa apakah kredensial publik Supabase sudah dikonfigurasi di environment.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Singleton instance Supabase client.
 * Bernilai `null` jika environment variable belum diisi, sehingga aplikasi
 * dapat menampilkan status konfigurasi secara jujur tanpa crash saat startup.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Mengambil instance Supabase client yang sudah terkonfigurasi atau melempar error
 * terstruktur jika kredensial belum tersedia.
 */
export function requireSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Konfigurasi Supabase belum diatur. Silakan isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.',
    );
  }
  return supabase;
}

