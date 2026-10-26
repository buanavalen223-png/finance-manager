import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, type RegisterFormValues } from '@/schemas/auth.schema';
import { signUpWithEmail } from '@/services/auth.service';

export function RegisterPage() {
  const { session, user, isConfigured } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [authError, setAuthError] = useState<string | null>(null);
  const [emailConfirmationSent, setEmailConfirmationSent] =
    useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (session && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: RegisterFormValues) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const result = await signUpWithEmail(values);
      if (result.requiresEmailConfirmation) {
        setEmailConfirmationSent(true);
        showToast({
          title: 'Verifikasi Email Diperlukan',
          description:
            'Kami telah mengirimkan tautan aktivasi ke alamat email Anda.',
          variant: 'info',
        });
      } else {
        showToast({
          title: 'Akun Berhasil Dibuat',
          description: 'Profil dan kategori awal Anda telah disiapkan.',
          variant: 'success',
        });
        navigate('/', { replace: true });
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Gagal mendaftarkan akun baru. Silakan coba kembali.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Buat Akun Finora AI"
      subtitle="Data keuangan Anda diisolasi secara penuh dengan Row Level Security."
      footer={
        <p>
          Sudah memiliki akun?{' '}
          <Link
            to="/auth/masuk"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Masuk di sini
          </Link>
        </p>
      }
    >
      {emailConfirmationSent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-semantic-income-soft text-semantic-income">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Periksa Kotak Masuk Email Anda
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              Tautan konfirmasi pendaftaran telah dikirimkan. Setelah mengklik
              tautan tersebut, profil dan kategori transaksi bawaan Anda akan
              langsung aktif.
            </p>
          </div>
          <Link
            to="/auth/masuk"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-brand px-4 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            Kembali ke Halaman Masuk
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {authError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md border border-semantic-expense/30 bg-semantic-expense-soft/60 p-3 text-xs text-semantic-expense"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{authError}</span>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="reg-fullname"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Nama Lengkap
            </label>
            <Input
              id="reg-fullname"
              type="text"
              autoComplete="name"
              placeholder="Contoh: Budi Santoso"
              disabled={isSubmitting}
              {...register('fullName')}
            />
            {errors.fullName ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Alamat Email
            </label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              disabled={isSubmitting}
              {...register('email')}
            />
            {errors.email ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-password"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Kata Sandi
              </label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 karakter"
                disabled={isSubmitting}
                {...register('password')}
              />
              {errors.password ? (
                <p className="mt-1 text-xs text-semantic-expense">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="reg-confirm"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Ulangi Kata Sandi
              </label>
              <Input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Ulangi sandi"
                disabled={isSubmitting}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword ? (
                <p className="mt-1 text-xs text-semantic-expense">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || !isConfigured}
            className="w-full"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? 'Mendaftarkan Akun...' : 'Daftar & Buat Buku Besar'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

