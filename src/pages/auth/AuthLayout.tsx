import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Database, Eye, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      {/* Top Bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-foreground">
            F
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight text-foreground">
              Finora AI
            </span>
            <span className="block text-[11px] text-muted">
              Personal Finance &amp; AI Assistant
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/pratinjau-ui"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            title="Lihat pratinjau UI Dashboard dengan data fixture terisolasi tanpa login"
          >
            <Eye className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            <span>Pratinjau UI Demo</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === 'dark'
                ? 'Beralih ke tema terang'
                : 'Beralih ke tema gelap'
            }
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-semantic-warning" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-brand" aria-hidden="true" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Auth Card */}
      <main className="mx-auto my-8 w-full max-w-md space-y-4">
        {!supabaseReady ? (
          <div
            role="status"
            className="rounded-lg border border-semantic-warning/40 bg-semantic-warning-soft/50 p-3.5 text-xs text-foreground"
          >
            <div className="flex items-start gap-2.5">
              <Database
                className="mt-0.5 h-4 w-4 shrink-0 text-semantic-warning"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-semibold">
                  Kredensial Supabase Belum Dikonfigurasi (.env)
                </p>
                <p className="leading-relaxed text-muted">
                  Isi <code>VITE_SUPABASE_URL</code> dan{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code> pada file <code>.env</code>{' '}
                  untuk mengaktifkan autentikasi database nyata, atau buka{' '}
                  <Link
                    to="/pratinjau-ui"
                    className="font-semibold text-brand underline underline-offset-2"
                  >
                    Pratinjau UI Demo Terisolasi
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <Card className="shadow-card">
          <CardHeader className="space-y-1 border-b border-border pb-4">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">{children}</CardContent>
        </Card>

        <div className="text-center text-xs text-muted">{footer}</div>
      </main>

      {/* Security Footer */}
      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted sm:flex-row">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
          <span>
            Dilindungi oleh Supabase Row Level Security (RLS) &bull; Isolasi Data{' '}
            <code>auth.uid() = user_id</code>
          </span>
        </div>
        <span>Finora AI &bull; Integer IDR</span>
      </footer>
    </div>
  );
}

