import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Calendar, LogIn, LogOut, Moon, Sun, Settings, User } from 'lucide-react';
import { NAV_ITEMS } from './navigation';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { getCurrentMonthPeriod } from '@/lib/date';
import { Button } from '@/components/ui/Button';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const { showToast } = useToast();
  const currentPeriod = getCurrentMonthPeriod();

  const activeNav =
    NAV_ITEMS.find((item) =>
      item.path === '/'
        ? location.pathname === '/' || location.pathname === '/pratinjau-ui'
        : location.pathname.startsWith(item.path),
    ) ?? NAV_ITEMS[0];

  const handleQuickLogout = async () => {
    try {
      await signOut();
      showToast({
        title: 'Berhasil Keluar',
        description: 'Sesi Anda telah diakhiri dengan aman.',
        variant: 'info',
      });
      navigate('/auth/masuk', { replace: true });
    } catch (err) {
      showToast({
        title: 'Gagal Keluar',
        description: err instanceof Error ? err.message : 'Silakan coba kembali.',
        variant: 'error',
      });
    }
  };

  const displayName =
    profile?.fullName?.trim() ||
    user?.email?.split('@')[0] ||
    null;

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {/* Mobile Brand Badge */}
        <Link
          to={user ? '/' : '/pratinjau-ui'}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-foreground lg:hidden"
          aria-label="Beranda Finora AI"
        >
          F
        </Link>
        <div>
          <h1 className="text-base font-semibold leading-tight text-foreground sm:text-lg">
            {activeNav.label}
          </h1>
          <p className="hidden text-xs text-muted sm:block">
            {activeNav.shortDescription}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <div
          className="hidden items-center gap-1.5 rounded-md border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground xl:flex"
          title="Periode buku besar aktif"
        >
          <Calendar className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          <span>{currentPeriod.label}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label={
            resolvedTheme === 'dark'
              ? 'Beralih ke tema terang'
              : 'Beralih ke tema gelap'
          }
          title={
            resolvedTheme === 'dark'
              ? 'Beralih ke tema terang'
              : 'Beralih ke tema gelap'
          }
        >
          {resolvedTheme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-semantic-warning" aria-hidden="true" />
              <span className="hidden sm:inline">Terang</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-brand" aria-hidden="true" />
              <span className="hidden sm:inline">Gelap</span>
            </>
          )}
        </Button>

        {user ? (
          <>
            <Link
              to="/pengaturan"
              className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted md:inline-flex"
              title="Profil & Pengaturan"
            >
              <User className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
              <span className="max-w-[120px] truncate">{displayName}</span>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleQuickLogout();
              }}
              aria-label="Keluar dari akun"
              title="Keluar dari akun"
            >
              <LogOut
                className="h-3.5 w-3.5 text-semantic-expense"
                aria-hidden="true"
              />
              <span className="hidden md:inline">Keluar</span>
            </Button>
          </>
        ) : (
          <Link
            to="/auth/masuk"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Masuk</span>
          </Link>
        )}

        <Link
          to={user ? '/pengaturan' : '/auth/masuk'}
          aria-label="Buka pengaturan aplikasi"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-foreground md:hidden"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
