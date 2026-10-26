import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bell,
  LogOut,
  Monitor,
  Moon,
  Save,
  Shield,
  Sun,
  UserCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { formatIDR } from '@/lib/currency';
import {
  notificationPreferencesSchema,
  profileUpdateSchema,
  type NotificationPreferencesFormValues,
  type ProfileUpdateFormValues,
} from '@/schemas/auth.schema';
import type { ThemePreference } from '@/types/domain';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: 'light',
    label: 'Terang (Warm Off-White)',
    description:
      'Latar #F7F7F2 dengan aksen Emerald #176B52 dan teks Charcoal #222824.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Gelap (Charcoal Dark)',
    description:
      'Permukaan gelap yang tenang dan nyaman untuk penggunaan malam hari.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Ikuti Sistem Operasi',
    description: 'Menyesuaikan otomatis dengan pengaturan perangkat Anda.',
    icon: Monitor,
  },
];

export function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const {
    user,
    profile,
    notificationPreferences,
    saveProfile,
    saveNotificationPreferences,
    signOut,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const supabaseReady = isSupabaseConfigured();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const profileForm = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
      themePreference: profile?.themePreference ?? theme,
    },
  });

  const notifForm = useForm<NotificationPreferencesFormValues>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      budgetAlertEnabled: notificationPreferences?.budgetAlertEnabled ?? true,
      recurringReminderEnabled:
        notificationPreferences?.recurringReminderEnabled ?? true,
      debtReminderEnabled: notificationPreferences?.debtReminderEnabled ?? true,
      weeklySummaryEnabled:
        notificationPreferences?.weeklySummaryEnabled ?? false,
      reminderDaysBefore: notificationPreferences?.reminderDaysBefore ?? 3,
    },
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        fullName: profile.fullName,
        themePreference: profile.themePreference,
      });
    }
  }, [profile, profileForm]);

  useEffect(() => {
    if (notificationPreferences) {
      notifForm.reset({
        budgetAlertEnabled: notificationPreferences.budgetAlertEnabled,
        recurringReminderEnabled:
          notificationPreferences.recurringReminderEnabled,
        debtReminderEnabled: notificationPreferences.debtReminderEnabled,
        weeklySummaryEnabled: notificationPreferences.weeklySummaryEnabled,
        reminderDaysBefore: notificationPreferences.reminderDaysBefore,
      });
    }
  }, [notificationPreferences, notifForm]);

  const handleSaveProfile = async (values: ProfileUpdateFormValues) => {
    setSavingProfile(true);
    try {
      await saveProfile(values);
      showToast({
        title: 'Profil Diperbarui',
        description: 'Perubahan nama dan preferensi tema telah disimpan ke Supabase.',
        variant: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan Profil',
        description:
          err instanceof Error ? err.message : 'Silakan coba kembali.',
        variant: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async (
    values: NotificationPreferencesFormValues,
  ) => {
    setSavingNotifications(true);
    try {
      await saveNotificationPreferences(values);
      showToast({
        title: 'Preferensi Notifikasi Tersimpan',
        description: 'Pengaturan pengingat keuangan Anda telah diperbarui.',
        variant: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan Preferensi',
        description:
          err instanceof Error ? err.message : 'Silakan coba kembali.',
        variant: 'error',
      });
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleConfirmLogout = async () => {
    try {
      await signOut();
      showToast({
        title: 'Sesi Berakhir',
        description: 'Anda telah keluar dari akun Finora AI.',
        variant: 'info',
      });
      navigate('/auth/masuk', { replace: true });
    } catch (err) {
      showToast({
        title: 'Gagal Keluar',
        description:
          err instanceof Error ? err.message : 'Silakan coba kembali.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Profil Pengguna (Terhubung ke public.profiles Supabase) */}
      <Card>
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-4 w-4 text-brand" aria-hidden="true" />
            <div>
              <CardTitle>Profil Pengguna</CardTitle>
              <CardDescription>
                Identitas akun yang terhubung langsung dengan{' '}
                <code>public.profiles</code> (RLS <code>auth.uid() = id</code>).
              </CardDescription>
            </div>
          </div>

          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmLogoutOpen(true)}
            >
              <LogOut
                className="h-3.5 w-3.5 text-semantic-expense"
                aria-hidden="true"
              />
              Keluar Sesi
            </Button>
          ) : null}
        </CardHeader>

        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit(handleSaveProfile)}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-email"
                  className="mb-1.5 block text-xs font-medium text-foreground"
                >
                  Alamat Email Terautentikasi
                </label>
                <Input
                  id="profile-email"
                  value={user?.email ?? 'Belum masuk (Mode Pratinjau)'}
                  disabled
                  className="bg-surface-muted text-muted"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-fullname"
                  className="mb-1.5 block text-xs font-medium text-foreground"
                >
                  Nama Tampilan
                </label>
                <Input
                  id="profile-fullname"
                  placeholder="Nama lengkap Anda"
                  disabled={!user || savingProfile}
                  {...profileForm.register('fullName')}
                />
                {profileForm.formState.errors.fullName ? (
                  <p className="mt-1 text-xs text-semantic-expense">
                    {profileForm.formState.errors.fullName.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted">
                Mata Uang Dasar: <strong>IDR (Rupiah)</strong>
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!user || savingProfile}
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Preferensi Notifikasi (Terhubung ke public.notification_preferences) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand" aria-hidden="true" />
            <CardTitle>Preferensi Pengingat &amp; Notifikasi</CardTitle>
          </div>
          <CardDescription>
            Pengaturan peringatan anggaran dan tagihan pada tabel{' '}
            <code>public.notification_preferences</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={notifForm.handleSubmit(handleSaveNotifications)}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-xs">
                <input
                  type="checkbox"
                  disabled={!user || savingNotifications}
                  className="mt-0.5 h-4 w-4 accent-brand"
                  {...notifForm.register('budgetAlertEnabled')}
                />
                <div>
                  <span className="font-semibold text-foreground">
                    Peringatan Batas Anggaran
                  </span>
                  <p className="mt-0.5 text-muted">
                    Beri tahu saat pengeluaran kategori melewati ambang peringatan.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-xs">
                <input
                  type="checkbox"
                  disabled={!user || savingNotifications}
                  className="mt-0.5 h-4 w-4 accent-brand"
                  {...notifForm.register('recurringReminderEnabled')}
                />
                <div>
                  <span className="font-semibold text-foreground">
                    Pengingat Tagihan Berulang
                  </span>
                  <p className="mt-0.5 text-muted">
                    Tampilkan pengingat sebelum tanggal jatuh tempo tagihan rutin.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-xs">
                <input
                  type="checkbox"
                  disabled={!user || savingNotifications}
                  className="mt-0.5 h-4 w-4 accent-brand"
                  {...notifForm.register('debtReminderEnabled')}
                />
                <div>
                  <span className="font-semibold text-foreground">
                    Pengingat Jatuh Tempo Utang/Piutang
                  </span>
                  <p className="mt-0.5 text-muted">
                    Tampilkan pengingat kewajiban utang dan piutang yang belum lunas.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-xs">
                <input
                  type="checkbox"
                  disabled={!user || savingNotifications}
                  className="mt-0.5 h-4 w-4 accent-brand"
                  {...notifForm.register('weeklySummaryEnabled')}
                />
                <div>
                  <span className="font-semibold text-foreground">
                    Ringkasan Arus Kas Mingguan
                  </span>
                  <p className="mt-0.5 text-muted">
                    Sajikan evaluasi arus kas mingguan di beranda.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-xs">
                <label
                  htmlFor="notif-days"
                  className="font-medium text-foreground"
                >
                  Ingatkan H- (hari sebelum jatuh tempo):
                </label>
                <Input
                  id="notif-days"
                  type="number"
                  min={0}
                  max={30}
                  disabled={!user || savingNotifications}
                  className="h-8 w-20 text-center tabular-nums"
                  {...notifForm.register('reminderDaysBefore', {
                    valueAsNumber: true,
                  })}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!user || savingNotifications}
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {savingNotifications
                  ? 'Menyimpan...'
                  : 'Simpan Preferensi Notifikasi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. Pengaturan Tema Visual */}
      <Card>
        <CardHeader>
          <CardTitle>Preferensi Tampilan &amp; Tema</CardTitle>
          <CardDescription>
            Pilih mode warna Minimalist Premium Fintech. Perubahan langsung
            diterapkan pada peramban Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setTheme(option.value);
                    profileForm.setValue('themePreference', option.value);
                  }}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-brand bg-brand-soft/60 text-foreground'
                      : 'border-border bg-surface text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <div className="mb-2.5 flex w-full items-center justify-between">
                    <div className="rounded-md bg-brand-soft p-2 text-brand-soft-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    {isSelected ? <Badge variant="brand">Aktif</Badge> : null}
                  </div>
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-muted">{option.description}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Tema efektif saat ini:{' '}
            <strong className="font-semibold text-foreground uppercase">
              {resolvedTheme}
            </strong>
          </p>
        </CardContent>
      </Card>

      {/* 4. Diagnostik Lingkungan & Keamanan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand" aria-hidden="true" />
            <CardTitle>Diagnostik Lingkungan &amp; Isolasi Data (Milestone 2)</CardTitle>
          </div>
          <CardDescription>
            Status aktual konfigurasi aplikasi tanpa membocorkan nilai kunci rahasia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border text-sm">
            <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
              <dt className="font-medium text-foreground">Koneksi Klien Supabase</dt>
              <dd>
                {supabaseReady ? (
                  <Badge variant="income">Terkonfigurasi</Badge>
                ) : (
                  <Badge variant="warning">
                    Belum Diatur (Isi VITE_SUPABASE_URL &amp; ANON_KEY di .env)
                  </Badge>
                )}
              </dd>
            </div>

            <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
              <dt className="font-medium text-foreground">
                Penegakan Kepemilikan Data (RLS)
              </dt>
              <dd className="text-xs text-muted">
                <code>auth.uid() = user_id</code> + Trigger{' '}
                <code>enforce_owner_user_id()</code>
              </dd>
            </div>

            <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
              <dt className="font-medium text-foreground">
                Representasi &amp; Format Mata Uang
              </dt>
              <dd className="tabular-nums text-xs text-muted">
                Integer IDR (Locale <code>id-ID</code>) &mdash; Contoh:{' '}
                <strong className="text-foreground">{formatIDR(12500000)}</strong>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          void handleConfirmLogout();
        }}
        title="Keluar dari Sesi Finora AI?"
        description="Sesi lokal Anda akan dihapus dari peramban ini. Anda dapat masuk kembali kapan saja."
        confirmLabel="Ya, Keluar"
        variant="danger"
      />
    </div>
  );
}
