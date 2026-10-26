import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, LogIn } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginFormValues } from '@/schemas/auth.schema';
import { signInWithEmail } from '@/services/auth.service';

export function LoginPage() {
  const { session, user, isConfigured } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const redirectTarget =
    (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (session && user) {
    return <Navigate to={redirectTarget} replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(values);
      showToast({
        title: 'Berhasil Masuk',
        description: 'Selamat datang kembali di Finora AI.',
        variant: 'success',
      });
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Gagal masuk ke akun Anda. Silakan coba kembali.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Masuk ke Finora AI"
      subtitle="Kelola buku besar pribadi Anda dengan aman dan terisolasi."
      footer={
        <p>
          Belum memiliki akun Finora AI?{' '}
          <Link
            to="/auth/daftar"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Daftar Akun Baru
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {authError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-semantic-expense/30 bg-semantic-expense-soft/60 p-3 text-xs text-semantic-expense"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{authError}</span>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Alamat Email
          </label>
          <Input
            id="login-email"
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-xs font-medium text-foreground"
            >
              Kata Sandi
            </label>
            <Link
              to="/auth/lupa-sandi"
              className="text-xs font-medium text-brand underline-offset-4 hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            disabled={isSubmitting}
            {...register('password')}
          />
          {errors.password ? (
            <p className="mt-1 text-xs text-semantic-expense">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting || !isConfigured}
          className="w-full"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? 'Memverifikasi Sesi...' : 'Masuk ke Buku Besar'}
        </Button>
      </form>
    </AuthLayout>
  );
}

