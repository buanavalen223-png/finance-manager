import { Database, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Link } from 'react-router-dom';

/**
 * Menampilkan status koneksi database Supabase secara jujur tanpa memalsukan
 * data produksi (sesuai aturan anti-mock pada AGENTS.md).
 */
export function ConfigStatusBanner() {
  const configured = isSupabaseConfigured();

  if (configured) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-xs text-muted shadow-subtle">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span>
            Koneksi klien Supabase terkonfigurasi. Seluruh operasi data dilindungi oleh Row Level Security (RLS).
          </span>
        </div>
        <Link
          to="/pengaturan"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Detail Sistem
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-xs sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-semantic-warning sm:mt-0" aria-hidden="true" />
        <div>
          <span className="font-semibold text-foreground">
            Mode Fondasi (Milestone 1) — Database Belum Terhubung:
          </span>{' '}
          <span className="text-muted">
            Variabel <code className="rounded bg-surface-muted px-1 py-0.5">VITE_SUPABASE_URL</code> dan{' '}
            <code className="rounded bg-surface-muted px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> belum diatur di{' '}
            <code className="rounded bg-surface-muted px-1 py-0.5">.env</code>. Tidak ada data tiruan yang disembunyikan.
          </span>
        </div>
      </div>
      <Link
        to="/pengaturan"
        className="shrink-0 font-medium text-brand underline-offset-4 hover:underline"
      >
        Periksa Konfigurasi &rarr;
      </Link>
    </div>
  );
}

