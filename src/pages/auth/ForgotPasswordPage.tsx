import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import {
  forgotPasswordSchema,
  updatePasswordSchema,
  type ForgotPasswordFormValues,
  type UpdatePasswordFormValues,
} from '@/schemas/auth.schema';
import {
  sendPasswordResetEmail,
  updateUserPassword,
} from '@/services/auth.service';

export function ForgotPasswordPage() {
  const { isConfigured, isPasswordRecovery } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isResetMode =
    isPasswordRecovery || searchParams.get('mode') === 'reset';

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const requestForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const updateForm = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onRequestReset = async (values: ForgotPasswordFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(values);
      setEmailSent(true);
      showToast({
        title: 'Tautan Pemulihan Dikirim',
        description:
          'Silakan periksa kotak masuk email Anda untuk mengatur ulang kata sandi.',
        variant: 'info',
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim email pemulihan kata sandi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onUpdatePassword = async (values: UpdatePasswordFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await updateUserPassword(values);
      showToast({
        title: 'Kata Sandi Diperbarui',
        description: 'Kata sandi baru Anda telah aktif.',
        variant: 'success',
      });
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui kata sandi baru.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={isResetMode ? 'Atur Kata Sandi Baru' : 'Pemulihan Kata Sandi'}
      subtitle={
        isResetMode
          ? 'Masukkan kata sandi baru untuk mengamankan akun Finora AI Anda.'
          : 'Kami akan mengirimkan tautan pemulihan ke alamat email terdaftar Anda.'
      }
      footer={
        <p>
          Ingat kata sandi Anda?{' '}
          <Link
            to="/auth/masuk"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Kembali ke Halaman Masuk
          </Link>
        </p>
      }
    >
      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-md border border-semantic-expense/30 bg-semantic-expense-soft/60 p-3 text-xs text-semantic-expense"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {isResetMode ? (
        <form
          onSubmit={updateForm.handleSubmit(onUpdatePassword)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="reset-new-password"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Kata Sandi Baru
            </label>
            <Input
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              disabled={isSubmitting}
              {...updateForm.register('password')}
            />
            {updateForm.formState.errors.password ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {updateForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Konfirmasi Kata Sandi Baru
            </label>
            <Input
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Ulangi kata sandi baru"
              disabled={isSubmitting}
              {...updateForm.register('confirmPassword')}
            />
            {updateForm.formState.errors.confirmPassword ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {updateForm.formState.errors.confirmPassword.message}
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
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? 'Menyimpan Kata Sandi...' : 'Simpan Kata Sandi Baru'}
          </Button>
        </form>
      ) : emailSent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-semantic-income-soft text-semantic-income">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Email Pemulihan Terkirim
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              Periksa kotak masuk (atau folder spam) email Anda dan ikuti tautan
              yang diberikan untuk mengatur ulang kata sandi.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailSent(false)}
            className="w-full"
          >
            Kirim Ulang ke Email Lain
          </Button>
        </div>
      ) : (
        <form
          onSubmit={requestForm.handleSubmit(onRequestReset)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="forgot-email"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Alamat Email Terdaftar
            </label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              disabled={isSubmitting}
              {...requestForm.register('email')}
            />
            {requestForm.formState.errors.email ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {requestForm.formState.errors.email.message}
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
            <Mail className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? 'Mengirim Tautan...' : 'Kirim Tautan Pemulihan'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

